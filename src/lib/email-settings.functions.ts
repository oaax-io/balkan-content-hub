import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  sendReservationConfirmation,
  sendReservationStatusUpdate,
  sendAdminNotification,
} from "./email.server";


const SettingsSchema = z.object({
  provider: z.enum(["lovable", "smtp"]),
  smtp_host: z.string().nullable().optional(),
  smtp_port: z.number().int().nullable().optional(),
  smtp_secure: z.boolean(),
  smtp_username: z.string().nullable().optional(),
  smtp_password: z.string().nullable().optional(),
  from_email: z.string().email().nullable().optional().or(z.literal("")),
  from_name: z.string().nullable().optional(),
  reply_to: z.string().email().nullable().optional().or(z.literal("")),
  enabled: z.boolean(),
});

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error || !data) throw new Error("Forbidden");
}

export const getEmailSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase.from("email_settings").select("*").eq("id", 1).maybeSingle();
    if (error) throw error;
    return data;
  });

export const updateEmailSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SettingsSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const payload = {
      ...data,
      from_email: data.from_email || null,
      reply_to: data.reply_to || null,
    };
    const { error } = await context.supabase.from("email_settings").update(payload).eq("id", 1);
    if (error) throw error;
    return { ok: true };
  });

const TestSchema = z.object({
  to: z.string().email(),
  template: z.enum([
    "request_received",
    "confirmed",
    "declined",
    "cancelled",
    "admin_notification",
  ]),
});

export const sendTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TestSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const sample = {
      id: "test-" + Date.now(),
      guest_name: "Max Muster",
      guest_email: data.to,
      guest_phone: "+41 79 000 00 00",
      party_size: 4,
      reservation_date: "2026-08-15",
      reservation_time: "19:30",
      notes: "Bitte einen Tisch am Fenster – dies ist eine Test-E-Mail.",
      status: "pending",
      cancellation_token: "test-token-1234567890abcdef",
      is_paid_occasion: true,
      occasion: "Silvester-Gala",
    };

    if (data.template === "request_received") {
      await sendReservationConfirmation(sample);
    } else if (data.template === "confirmed") {
      await sendReservationStatusUpdate({ ...sample, status: "confirmed" });
    } else if (data.template === "declined") {
      await sendReservationStatusUpdate({ ...sample, status: "declined" });
    } else if (data.template === "cancelled") {
      await sendReservationStatusUpdate({ ...sample, status: "cancelled" });
    } else if (data.template === "admin_notification") {
      // Notification geht normalerweise an Admin-Adresse — hier temporär überschreiben,
      // indem wir contact_info kurzzeitig nicht anfassen: sendAdminNotification liest
      // contact.notification_email/email. Für den Test senden wir daher direkt.
      const { sendReservationStatusUpdate: _unused } = await import("./email.server");
      // Simpler: wir bauen ein Fake-Contact-Overlay nicht — stattdessen nutzen wir
      // sendAdminNotification, aber temporär mit guest_email als Empfänger-Fallback:
      // Da sendAdminNotification hart contact.email liest, senden wir stattdessen
      // eine passende Test-Mail über sendReservationConfirmation-Pfad? Nein —
      // wir wollen wirklich die Admin-Vorlage sehen. Also nutzen wir sie regulär.
      await sendAdminNotification(sample);
    }

    return { ok: true };
  });
