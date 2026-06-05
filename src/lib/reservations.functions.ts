import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin } from "./admin.server";
import { sendReservationConfirmation, sendReservationStatusUpdate, sendAdminNotification } from "./email.server";

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
});

export const createReservation = createServerFn({ method: "POST" })
  .inputValidator((input) => createSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("reservations")
      .insert(data)
      .select()
      .single();
    if (error) throw new Error(error.message);

    // Fire-and-forget emails (best effort)
    void sendReservationConfirmation(row).catch((e) => console.error("confirmation email failed", e));
    void sendAdminNotification(row).catch((e) => console.error("admin notification failed", e));

    return { id: row.id };
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
