import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin } from "./admin.server";
import { sendReservationConfirmation, sendReservationStatusUpdate, sendAdminNotification } from "./email.server";
import { createStripeClient, getStripeErrorMessage, type StripeEnv } from "./stripe.server";
import { randomBytes } from "node:crypto";

function generateSecureToken(bytes = 48): string {
  return randomBytes(bytes).toString("base64url");
}

function isPaidOccasionServer(occasion: string): boolean {
  const s = (occasion || "").toLowerCase();
  return s.includes("99.- pro person") || s.includes("dinner & dance");
}

const createSchema = z.object({
  guest_name: z.string().trim().min(2).max(120),
  guest_email: z.string().trim().email().max(255),
  guest_phone: z.string().trim().max(40).default(""),
  country_code: z.string().trim().max(10).default(""),
  party_size: z.number().int().min(1).max(99),
  reservation_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default("1970-01-01"),
  reservation_time: z.string().regex(/^\d{2}:\d{2}$/).default("00:00"),
  occasion: z.string().trim().max(120).default(""),
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
    const isPaid = isPaidOccasionServer(data.occasion);

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

    const insertRow = {
      guest_name: data.guest_name,
      guest_email: data.guest_email,
      guest_phone: data.guest_phone,
      country_code: data.country_code,
      party_size: data.party_size,
      reservation_date: data.reservation_date,
      reservation_time: data.reservation_time,
      occasion: data.occasion,
      event_date_label: data.event_date_label,
      notes: data.notes,
      is_paid_occasion: isPaid,
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

    // Fire-and-forget emails (best effort)
    void sendReservationConfirmation(row).catch((e) => console.error("confirmation email failed", e));
    void sendAdminNotification(row).catch((e) => console.error("admin notification failed", e));

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
    if (!isPaidOccasionServer(data.occasion)) {
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
      void sendReservationStatusUpdate(row).catch((e) => console.error("status email failed", e));
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
      void sendReservationStatusUpdate({ ...r, status: "cancelled" }).catch((e) =>
        console.error("cancel email failed", e),
      );
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

    const amount = r.cancellation_fee_amount ?? 5000;
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

      void sendReservationStatusUpdate({ ...r, status: "cancelled" }).catch((e) =>
        console.error("cancel email failed", e),
      );

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
