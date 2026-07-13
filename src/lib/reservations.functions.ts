import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin } from "./admin.server";
import { sendReservationConfirmation, sendReservationStatusUpdate, sendAdminNotification, sendAdminCancellationNotification } from "./email.server";
import { createStripeClient, getStripeErrorMessage, type StripeEnv } from "./stripe.server";
import { randomBytes } from "node:crypto";

function generateSecureToken(bytes = 48): string {
  return randomBytes(bytes).toString("base64url");
}

async function loadPaidOccasions(): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from("site_content").select("value").eq("key", "reservation_paid_occasions").maybeSingle();
  return (data?.value || "")
    .split("\n").map((s) => s.trim()).filter(Boolean);
}

async function isPaidOccasionServer(occasion: string): Promise<boolean> {
  const list = await loadPaidOccasions();
  const s = (occasion || "").trim().toLowerCase();
  if (!s) return false;
  if (list.length > 0) return list.some((p) => p.trim().toLowerCase() === s);
  return s.includes("99.- pro person") || s.includes("dinner & dance");
}

const GERMAN_MONTHS: Record<string, number> = {
  januar: 1, februar: 2, märz: 3, april: 4, mai: 5, juni: 6,
  juli: 7, august: 8, september: 9, oktober: 10, november: 11, dezember: 12,
};

function parseEventDateLabel(label: string): { date: string; time: string } | null {
  const raw = (label || "").trim();
  if (!raw) return null;

  // Bevorzugtes Format: "YYYY-MM-DD | Anzeige-Label" oder "YYYY-MM-DD HH:MM | Anzeige-Label"
  const pipeIdx = raw.indexOf("|");
  const machinePart = pipeIdx >= 0 ? raw.slice(0, pipeIdx).trim() : raw;

  const isoMatch = machinePart.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}))?$/);
  if (isoMatch) {
    const [, y, m, d, hh, mm] = isoMatch;
    const date = `${y}-${m}-${d}`;
    const time = hh && mm ? `${hh}:${mm}` : "19:30";
    return { date, time };
  }

  // Bestehende deutsche Labels: "Samstag, 20. Juni 2026" oder "20. Juni 2026"
  const germanMatch = raw.match(/(\d{1,2})\.\s*([A-Za-zäöüÄÖÜ]+)\s+(\d{4})/);
  if (germanMatch) {
    const [, day, monthName, year] = germanMatch;
    const month = GERMAN_MONTHS[monthName.toLowerCase()];
    if (month) {
      const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return { date, time: "19:30" };
    }
  }

  return null;
}

const createSchema = z.object({
  guest_name: z.string().trim().min(2).max(120),
  guest_email: z.string().trim().email().max(255),
  guest_phone: z.string().trim().max(40).default(""),
  country_code: z.string().trim().max(10).default(""),
  party_size: z.number().int().min(2).max(99),
  reservation_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default("1970-01-01"),
  reservation_time: z.string().regex(/^\d{2}:\d{2}$/).default("00:00"),
  occasion: z.string().trim().max(120).default(""),
  event_date: z.string().trim().max(200).default(""),
  event_date_label: z.string().trim().max(200).default(""),
  notes: z.string().trim().max(1000).default(""),
  // Stripe / Storno-Bedingungen (nur bei kostenpflichtigen Anlässen befüllt)
  stripe_customer_id: z.string().trim().max(120).optional(),
  stripe_payment_method_id: z.string().trim().max(120).optional(),
  stripe_setup_intent_id: z.string().trim().max(120).optional(),
  cancellation_terms_accepted: z.boolean().optional(),
});

export const createReservation = createServerFn({ method: "POST" })
  .inputValidator((input) => createSchema.parse(input))
  .handler(async ({ data }) => {
    const isPaid = await isPaidOccasionServer(data.occasion);

    // Bei kostenpflichtigen Anlässen ist eine hinterlegte Zahlungsmethode + Zustimmung Pflicht.
    if (isPaid) {
      if (!data.stripe_customer_id || !data.stripe_payment_method_id || !data.stripe_setup_intent_id) {
        throw new Error("Für diesen Anlass ist eine hinterlegte Zahlungsmethode erforderlich.");
      }
      if (!data.cancellation_terms_accepted) {
        throw new Error("Bitte akzeptiere die Stornierungsbedingungen.");
      }
    }

    // Sicheres, nicht erratbares Storno-Token (256-bit)
    const cancellationToken = generateSecureToken(48);

    // Event-Datum aus dem maschinenlesbaren Wert oder dem Anzeige-Label parsen
    const parsedEvent = parseEventDateLabel(data.event_date) || parseEventDateLabel(data.event_date_label);
    const reservationDate = parsedEvent?.date ?? data.reservation_date;
    const reservationTime = parsedEvent?.time ?? data.reservation_time;

    const insertRow = {
      guest_name: data.guest_name,
      guest_email: data.guest_email,
      guest_phone: data.guest_phone,
      country_code: data.country_code,
      party_size: data.party_size,
      reservation_date: reservationDate,
      reservation_time: reservationTime,
      occasion: data.occasion,
      event_date_label: data.event_date_label,
      notes: data.notes,
      is_paid_occasion: isPaid,
      status: "confirmed" as const,
      stripe_customer_id: isPaid ? data.stripe_customer_id ?? null : null,
      stripe_payment_method_id: isPaid ? data.stripe_payment_method_id ?? null : null,
      stripe_setup_intent_id: isPaid ? data.stripe_setup_intent_id ?? null : null,
      cancellation_terms_accepted: isPaid ? !!data.cancellation_terms_accepted : false,
      cancellation_terms_accepted_at:
        isPaid && data.cancellation_terms_accepted ? new Date().toISOString() : null,
      cancellation_token: cancellationToken,
      cancellation_token_expires_at: null,
    };

    const { data: row, error } = await supabaseAdmin
      .from("reservations")
      .insert(insertRow)
      .select()
      .single();
    if (error) throw new Error(error.message);

    // Direkte Bestätigung – kein Admin-Approval nötig.
    await sendReservationStatusUpdate(row);
    await sendAdminNotification(row);


    return { id: row.id };
  });

// SetupIntent für kostenpflichtige Reservationen erstellen.
// Speichert eine Zahlungsmethode am Kunden, ohne Geld abzubuchen.
const setupSchema = z.object({
  guest_name: z.string().trim().min(2).max(120),
  guest_email: z.string().trim().email().max(255),
  occasion: z.string().trim().max(120),
  environment: z.enum(["sandbox", "live"]),
});

type SetupResult =
  | { client_secret: string; customer_id: string }
  | { error: string };

export const createReservationSetupIntent = createServerFn({ method: "POST" })
  .inputValidator((input) => setupSchema.parse(input))
  .handler(async ({ data }): Promise<SetupResult> => {
    if (!(await isPaidOccasionServer(data.occasion))) {
      return { error: "Für diesen Anlass ist keine Zahlungsmethode nötig." };
    }
    try {
      const stripe = createStripeClient(data.environment as StripeEnv);
      // Bestehenden Customer per Email suchen; sonst neu anlegen.
      const existing = await stripe.customers.list({ email: data.guest_email, limit: 1 });
      const customer = existing.data[0]
        ?? (await stripe.customers.create({
          email: data.guest_email,
          name: data.guest_name,
          metadata: { source: "balkaneros_reservation", occasion: data.occasion },
        }));

      const setupIntent = await stripe.setupIntents.create({
        customer: customer.id,
        usage: "off_session",
        automatic_payment_methods: { enabled: true },
        metadata: { source: "balkaneros_reservation", occasion: data.occasion },
      });

      return {
        client_secret: setupIntent.client_secret ?? "",
        customer_id: customer.id,
      };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });


export const listReservations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("reservations")
      .select("*")
      .order("reservation_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data;
  });

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pending", "confirmed", "declined", "cancelled"]),
  admin_note: z.string().max(500).optional(),
});

export const updateReservationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const patch: { status: typeof data.status; admin_note?: string } = { status: data.status };
    if (data.admin_note !== undefined) patch.admin_note = data.admin_note;
    const { data: row, error } = await supabaseAdmin
      .from("reservations")
      .update(patch)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (data.status === "confirmed" || data.status === "declined") {
      try { await sendReservationStatusUpdate(row); } catch (e) { console.error("status email failed", e); }
    }
    return { ok: true };
  });

// ---- Occasion capacities ----
export const listOccasionCapacities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("occasion_capacities")
      .select("*");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const capSchema = z.object({
  occasion: z.string().trim().min(1).max(120),
  max_reservations: z.number().int().min(0).max(100000),
});
export const setOccasionCapacity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => capSchema.parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("occasion_capacities")
      .upsert({ occasion: data.occasion, max_reservations: data.max_reservations });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- Storno / Cancellation ----
const cancelSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
  environment: z.enum(["sandbox", "live"]).default("sandbox"),
});

type CancelResult =
  | { ok: true; fee_charged: boolean; days_until: number; payment_intent_id?: string }
  | { ok: false; error: string };

export const cancelReservation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => cancelSchema.parse(i))
  .handler(async ({ data, context }): Promise<CancelResult> => {
    await requireAdmin(context.userId);

    // 1) Reservation laden
    const { data: r, error: loadErr } = await supabaseAdmin
      .from("reservations")
      .select("*")
      .eq("id", data.id)
      .single();
    if (loadErr || !r) return { ok: false, error: loadErr?.message ?? "Reservation nicht gefunden" };

    if (r.status === "cancelled") {
      return { ok: false, error: "Reservation ist bereits storniert." };
    }

    // 2) Tage bis zum Anlass berechnen (Basis: reservation_date)
    const eventDate = new Date(`${r.reservation_date}T${r.reservation_time || "00:00"}:00`);
    const now = new Date();
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysUntil = Math.floor((eventDate.getTime() - now.getTime()) / msPerDay);

    const isPaid = !!r.is_paid_occasion;
    // Kostenpflichtige Gebühr nur bei kostenpflichtigem Anlass UND < 7 Tage vor Event
    const feeApplies = isPaid && daysUntil < 7;

    // 3) Kostenlose Stornierung
    if (!feeApplies) {
      const { error: updErr } = await supabaseAdmin
        .from("reservations")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancellation_reason: data.reason ?? null,
        })
        .eq("id", data.id);
      if (updErr) return { ok: false, error: updErr.message };
      try { await sendReservationStatusUpdate({ ...r, status: "cancelled" }); } catch (e) {
        console.error("cancel email failed", e);
      }
      try { await sendAdminCancellationNotification({ ...r, status: "cancelled" }, false); } catch (e) {
        console.error("admin cancel email failed", e);
      }
      return { ok: true, fee_charged: false, days_until: daysUntil };
    }

    // 4) Kostenpflichtige Stornierung — Doppel-Belastung verhindern
    if (r.cancellation_fee_charged_at || r.cancellation_fee_payment_intent_id) {
      return { ok: false, error: "Für diese Reservation wurde bereits eine Gebühr belastet." };
    }
    if (!r.stripe_customer_id || !r.stripe_payment_method_id) {
      return {
        ok: false,
        error: "Keine hinterlegte Zahlungsmethode gefunden. Stornierung nicht möglich.",
      };
    }

    const perPerson = r.cancellation_fee_amount ?? 5000;
    const partySize = Math.max(1, r.party_size ?? 1);
    const amount = perPerson * partySize;
    const currency = (r.cancellation_fee_currency ?? "chf").toLowerCase();

    // 5) Stripe PaymentIntent off_session erstellen und sofort bestätigen
    try {
      const stripe = createStripeClient(data.environment as StripeEnv);
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency,
        customer: r.stripe_customer_id,
        payment_method: r.stripe_payment_method_id,
        off_session: true,
        confirm: true,
        description: `Balkaneros Storno-Gebühr — ${r.occasion} (${r.guest_name})`,
        metadata: {
          reservation_id: r.id,
          type: "cancellation_fee",
          occasion: r.occasion,
        },
      });

      if (paymentIntent.status !== "succeeded" && paymentIntent.status !== "processing") {
        // Nicht als bezahlt markieren
        const { error: updErr } = await supabaseAdmin
          .from("reservations")
          .update({
            cancellation_fee_charge_status: paymentIntent.status,
            cancellation_fee_payment_intent_id: paymentIntent.id,
          })
          .eq("id", data.id);
        if (updErr) console.error(updErr.message);
        return {
          ok: false,
          error: `Zahlung fehlgeschlagen (Status: ${paymentIntent.status}). Reservation wurde nicht storniert.`,
        };
      }

      // 6) Erfolg speichern
      const { error: updErr } = await supabaseAdmin
        .from("reservations")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancellation_reason: data.reason ?? null,
          cancellation_fee_charged_at: new Date().toISOString(),
          cancellation_fee_payment_intent_id: paymentIntent.id,
          cancellation_fee_charge_status: paymentIntent.status,
        })
        .eq("id", data.id);
      if (updErr) return { ok: false, error: updErr.message };

      try { await sendReservationStatusUpdate({ ...r, status: "cancelled" }); } catch (e) {
        console.error("cancel email failed", e);
      }
      try { await sendAdminCancellationNotification({ ...r, status: "cancelled" }, true); } catch (e) {
        console.error("admin cancel email failed", e);
      }

      return {
        ok: true,
        fee_charged: true,
        days_until: daysUntil,
        payment_intent_id: paymentIntent.id,
      };
    } catch (error) {
      const message = getStripeErrorMessage(error);
      // Fehlschlag im Log festhalten, aber nicht als bezahlt markieren
      await supabaseAdmin
        .from("reservations")
        .update({ cancellation_fee_charge_status: `failed: ${message.slice(0, 200)}` })
        .eq("id", data.id);
      return { ok: false, error: `Stripe-Belastung fehlgeschlagen: ${message}` };
    }
  });

// ---- No-Show Gebühr (Admin) ----
const noShowSchema = z.object({
  id: z.string().uuid(),
  environment: z.enum(["sandbox", "live"]).default("sandbox"),
});

type NoShowResult =
  | { ok: true; payment_intent_id: string }
  | { ok: false; error: string };

export const chargeNoShowFee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => noShowSchema.parse(i))
  .handler(async ({ data, context }): Promise<NoShowResult> => {
    await requireAdmin(context.userId);

    const { data: r, error: loadErr } = await supabaseAdmin
      .from("reservations")
      .select("*")
      .eq("id", data.id)
      .single();
    if (loadErr || !r) return { ok: false, error: loadErr?.message ?? "Reservation nicht gefunden" };

    if (!r.is_paid_occasion) {
      return { ok: false, error: "Nur kostenpflichtige Anlässe können belastet werden." };
    }
    if (r.cancellation_fee_charged_at || r.cancellation_fee_payment_intent_id) {
      return { ok: false, error: "Für diese Reservation wurde bereits eine Gebühr belastet." };
    }
    if (!r.stripe_customer_id || !r.stripe_payment_method_id) {
      return { ok: false, error: "Keine hinterlegte Zahlungsmethode gefunden." };
    }

    const amount = r.cancellation_fee_amount ?? 5000;
    const currency = (r.cancellation_fee_currency ?? "chf").toLowerCase();

    try {
      const stripe = createStripeClient(data.environment as StripeEnv);
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency,
        customer: r.stripe_customer_id,
        payment_method: r.stripe_payment_method_id,
        off_session: true,
        confirm: true,
        description: `Balkaneros No-Show Gebühr — ${r.occasion} (${r.guest_name})`,
        metadata: {
          reservation_id: r.id,
          type: "no_show_fee",
          occasion: r.occasion,
        },
      });

      if (paymentIntent.status !== "succeeded" && paymentIntent.status !== "processing") {
        await supabaseAdmin
          .from("reservations")
          .update({
            cancellation_fee_charge_status: paymentIntent.status,
            cancellation_fee_payment_intent_id: paymentIntent.id,
          })
          .eq("id", data.id);
        return {
          ok: false,
          error: `Zahlung fehlgeschlagen (Status: ${paymentIntent.status}).`,
        };
      }

      const { error: updErr } = await supabaseAdmin
        .from("reservations")
        .update({
          cancellation_fee_charged_at: new Date().toISOString(),
          cancellation_fee_payment_intent_id: paymentIntent.id,
          cancellation_fee_charge_status: paymentIntent.status,
        })
        .eq("id", data.id);
      if (updErr) return { ok: false, error: updErr.message };

      return { ok: true, payment_intent_id: paymentIntent.id };
    } catch (error) {
      const message = getStripeErrorMessage(error);
      await supabaseAdmin
        .from("reservations")
        .update({ cancellation_fee_charge_status: `failed: ${message.slice(0, 200)}` })
        .eq("id", data.id);
      return { ok: false, error: `Stripe-Belastung fehlgeschlagen: ${message}` };
    }
  });

// ==============================================================
// Öffentliche Storno-Flow via Token (aus Bestätigungs-E-Mail)
// Kein Auth nötig — der Token ist die Autorisierung.
// ==============================================================

type PublicReservationInfo = {
  id: string;
  guest_name: string;
  reservation_date: string;
  reservation_time: string;
  party_size: number;
  occasion: string;
  event_date_label: string | null;
  status: string;
  is_paid_occasion: boolean;
  fee_applies: boolean;
  days_until: number;
  already_cancelled: boolean;
  fee_already_charged: boolean;
  fee_amount: number;
  fee_currency: string;
};

function computeFeeContext(r: {
  reservation_date: string;
  reservation_time: string | null;
  is_paid_occasion: boolean | null;
}) {
  const eventDate = new Date(`${r.reservation_date}T${r.reservation_time || "00:00"}:00`);
  const days_until = Math.floor((eventDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const fee_applies = !!r.is_paid_occasion && days_until < 7;
  return { days_until, fee_applies };
}

const tokenSchema = z.object({ token: z.string().trim().min(20).max(200) });

export const getReservationByToken = createServerFn({ method: "POST" })
  .inputValidator((i) => tokenSchema.parse(i))
  .handler(async ({ data }): Promise<{ ok: true; info: PublicReservationInfo } | { ok: false; error: string }> => {
    const { data: r, error } = await supabaseAdmin
      .from("reservations")
      .select("*")
      .eq("cancellation_token", data.token)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!r) return { ok: false, error: "Ungültiger oder abgelaufener Storno-Link." };
    if (r.cancellation_token_expires_at && new Date(r.cancellation_token_expires_at) < new Date()) {
      return { ok: false, error: "Der Storno-Link ist abgelaufen." };
    }
    const { days_until, fee_applies } = computeFeeContext(r);
    return {
      ok: true,
      info: {
        id: r.id,
        guest_name: r.guest_name,
        reservation_date: r.reservation_date,
        reservation_time: r.reservation_time,
        party_size: r.party_size,
        occasion: r.occasion ?? "",
        event_date_label: r.event_date_label ?? null,
        status: r.status,
        is_paid_occasion: !!r.is_paid_occasion,
        fee_applies,
        days_until,
        already_cancelled: r.status === "cancelled",
        fee_already_charged: !!(r.cancellation_fee_charged_at || r.cancellation_fee_payment_intent_id),
        fee_amount: r.cancellation_fee_amount ?? 5000,
        fee_currency: (r.cancellation_fee_currency ?? "chf").toUpperCase(),
      },
    };
  });

const cancelByTokenSchema = z.object({
  token: z.string().trim().min(20).max(200),
  reason: z.string().trim().max(500).optional(),
  environment: z.enum(["sandbox", "live"]).default("sandbox"),
});

type PublicCancelResult =
  | { ok: true; fee_charged: boolean; days_until: number; payment_intent_id?: string }
  | { ok: false; error: string };

export const cancelReservationByToken = createServerFn({ method: "POST" })
  .inputValidator((i) => cancelByTokenSchema.parse(i))
  .handler(async ({ data }): Promise<PublicCancelResult> => {
    const { data: r, error: loadErr } = await supabaseAdmin
      .from("reservations")
      .select("*")
      .eq("cancellation_token", data.token)
      .maybeSingle();
    if (loadErr) return { ok: false, error: loadErr.message };
    if (!r) return { ok: false, error: "Ungültiger Storno-Link." };
    if (r.cancellation_token_expires_at && new Date(r.cancellation_token_expires_at) < new Date()) {
      return { ok: false, error: "Der Storno-Link ist abgelaufen." };
    }
    if (r.status === "cancelled") {
      return { ok: false, error: "Diese Reservation wurde bereits storniert." };
    }

    const { days_until, fee_applies } = computeFeeContext(r);

    // Kostenlose Stornierung
    if (!fee_applies) {
      const { error: updErr } = await supabaseAdmin
        .from("reservations")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancellation_reason: data.reason ?? "Storniert via E-Mail-Link durch Gast",
        })
        .eq("id", r.id);
      if (updErr) return { ok: false, error: updErr.message };
      try { await sendReservationStatusUpdate({ ...r, status: "cancelled" }); } catch (e) {
        console.error("cancel email failed", e);
      }
      try { await sendAdminCancellationNotification({ ...r, status: "cancelled" }, false); } catch (e) {
        console.error("admin cancel email failed", e);
      }
      return { ok: true, fee_charged: false, days_until };
    }

    // Kostenpflichtige Stornierung — Doppelbelastung verhindern
    if (r.cancellation_fee_charged_at || r.cancellation_fee_payment_intent_id) {
      return { ok: false, error: "Für diese Reservation wurde bereits eine Gebühr belastet." };
    }
    if (!r.stripe_customer_id || !r.stripe_payment_method_id) {
      return { ok: false, error: "Keine hinterlegte Zahlungsmethode gefunden. Bitte kontaktieren Sie uns." };
    }

    const amount = r.cancellation_fee_amount ?? 5000;
    const currency = (r.cancellation_fee_currency ?? "chf").toLowerCase();

    try {
      const stripe = createStripeClient(data.environment as StripeEnv);
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency,
        customer: r.stripe_customer_id,
        payment_method: r.stripe_payment_method_id,
        off_session: true,
        confirm: true,
        description: `Balkaneros Storno-Gebühr — ${r.occasion} (${r.guest_name})`,
        metadata: {
          reservation_id: r.id,
          type: "cancellation_fee_guest",
          occasion: r.occasion ?? "",
        },
      });

      if (paymentIntent.status !== "succeeded" && paymentIntent.status !== "processing") {
        await supabaseAdmin
          .from("reservations")
          .update({
            cancellation_fee_charge_status: paymentIntent.status,
            cancellation_fee_payment_intent_id: paymentIntent.id,
          })
          .eq("id", r.id);
        return {
          ok: false,
          error: `Zahlung fehlgeschlagen (Status: ${paymentIntent.status}). Reservation wurde nicht storniert.`,
        };
      }

      const { error: updErr } = await supabaseAdmin
        .from("reservations")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancellation_reason: data.reason ?? "Storniert via E-Mail-Link durch Gast",
          cancellation_fee_charged_at: new Date().toISOString(),
          cancellation_fee_payment_intent_id: paymentIntent.id,
          cancellation_fee_charge_status: paymentIntent.status,
        })
        .eq("id", r.id);
      if (updErr) return { ok: false, error: updErr.message };

      try { await sendReservationStatusUpdate({ ...r, status: "cancelled" }); } catch (e) {
        console.error("cancel email failed", e);
      }
      try { await sendAdminCancellationNotification({ ...r, status: "cancelled" }, true); } catch (e) {
        console.error("admin cancel email failed", e);
      }

      return { ok: true, fee_charged: true, days_until, payment_intent_id: paymentIntent.id };
    } catch (error) {
      const message = getStripeErrorMessage(error);
      await supabaseAdmin
        .from("reservations")
        .update({ cancellation_fee_charge_status: `failed: ${message.slice(0, 200)}` })
        .eq("id", r.id);
      return { ok: false, error: `Zahlung fehlgeschlagen: ${message}` };
    }
  });

// ---- Reservation permanent löschen (Admin) ----
const deleteSchema = z.object({ id: z.string().uuid() });

export const deleteReservation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => deleteSchema.parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("reservations")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
