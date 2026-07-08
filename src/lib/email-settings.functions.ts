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
