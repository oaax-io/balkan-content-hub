import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin } from "./admin.server";
import { sendReservationConfirmation, sendReservationStatusUpdate, sendAdminNotification } from "./email.server";
import { createStripeClient, getStripeErrorMessage, type StripeEnv } from "./stripe.server";

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
