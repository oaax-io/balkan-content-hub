// Admin CRUD for email templates + server-side preview rendering.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error || !data) throw new Error("Forbidden");
}

const TEMPLATE_KEYS = [
  "reservation_request",
  "reservation_confirmed",
  "reservation_declined",
  "reservation_cancelled",
  "admin_notification",
  "admin_cancellation",
] as const;

export type EmailTemplateRow = {
  id: string;
  template_key: (typeof TEMPLATE_KEYS)[number];
  occasion: string | null;
  subject: string;
  body_html: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export const listEmailTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("email_templates")
      .select("*")
      .order("template_key", { ascending: true })
      .order("occasion", { ascending: true, nullsFirst: true });
    if (error) throw error;
    return (data ?? []) as EmailTemplateRow[];
  });

const UpsertSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  template_key: z.enum(TEMPLATE_KEYS),
  occasion: z.string().trim().max(120).nullable().optional(),
  subject: z.string().max(500),
  body_html: z.string(),
  enabled: z.boolean(),
});

export const upsertEmailTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpsertSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const occasion = data.occasion && data.occasion.trim() ? data.occasion.trim() : null;

    if (data.id) {
      const { error } = await context.supabase
        .from("email_templates")
        .update({
          subject: data.subject,
          body_html: data.body_html,
          enabled: data.enabled,
          occasion,
          template_key: data.template_key,
        })
        .eq("id", data.id);
      if (error) throw error;
      return { ok: true };
    }

    // Insert (or if a row with same key+occasion exists, update it)
    let existingId: string | null = null;
    if (occasion === null) {
      const { data: e } = await context.supabase
        .from("email_templates")
        .select("id")
        .eq("template_key", data.template_key)
        .is("occasion", null)
        .maybeSingle();
      existingId = e?.id ?? null;
    } else {
      const { data: e } = await context.supabase
        .from("email_templates")
        .select("id")
        .eq("template_key", data.template_key)
        .eq("occasion", occasion)
        .maybeSingle();
      existingId = e?.id ?? null;
    }


    if (existingId) {
      const { error } = await context.supabase
        .from("email_templates")
        .update({
          subject: data.subject,
          body_html: data.body_html,
          enabled: data.enabled,
        })
        .eq("id", existingId);
      if (error) throw error;
      return { ok: true, id: existingId };
    }

    const { data: inserted, error } = await context.supabase
      .from("email_templates")
      .insert({
        template_key: data.template_key,
        occasion,
        subject: data.subject,
        body_html: data.body_html,
        enabled: data.enabled,
      })
      .select("id")
      .single();
    if (error) throw error;
    return { ok: true, id: inserted.id };
  });

export const deleteEmailTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // Prevent deleting the default (occasion IS NULL) row.
    const { data: row } = await context.supabase
      .from("email_templates")
      .select("occasion")
      .eq("id", data.id)
      .maybeSingle();
    if (row && row.occasion === null) {
      throw new Error("Standard-Vorlage kann nicht gelöscht werden. Setze sie stattdessen auf 'deaktiviert'.");
    }
    const { error } = await context.supabase.from("email_templates").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

const PreviewSchema = z.object({
  subject: z.string(),
  body_html: z.string(),
  occasion: z.string().nullable().optional(),
});

export const previewEmailTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PreviewSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { buildTemplateVars, renderTemplate } = await import("./email.server");
    const sample = {
      id: "preview",
      guest_name: "Danijela Muster",
      guest_email: "danijela@example.com",
      guest_phone: "+41 79 000 00 00",
      party_size: 5,
      reservation_date: "2026-06-20",
      reservation_time: "20:00",
      notes: "Vegetarisches Menu, keine Nüsse bitte.",
      status: "confirmed",
      cancellation_token: "sample-token-1234567890",
      is_paid_occasion: true,
      occasion: data.occasion ?? "Dinner & Dance",
    };
    const vars = buildTemplateVars(sample, {
      restaurant: "Balkaneros",
      cancelUrl: "https://balkaneros.ch/reservation-cancel/sample-token-1234567890",
      feeCharged: false,
    });
    return {
      subject: renderTemplate(data.subject, vars),
      html: renderTemplate(data.body_html, vars),
    };
  });

// List of known occasions for the "add override" dropdown.
export const listReservationOccasions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data: caps } = await context.supabase
      .from("occasion_capacities")
      .select("occasion")
      .order("occasion");
    const { data: existing } = await context.supabase
      .from("reservations")
      .select("occasion")
      .not("occasion", "is", null);
    const set = new Set<string>();
    (caps ?? []).forEach((r: any) => r.occasion && set.add(r.occasion));
    (existing ?? []).forEach((r: any) => r.occasion && set.add(r.occasion));
    return Array.from(set).sort();
  });
