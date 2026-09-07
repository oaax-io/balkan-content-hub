import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin } from "./admin.server";

export const listNewsletterSubscribers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("newsletter_subscribers")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().max(160).default(""),
  email: z.string().trim().email().max(255),
  note: z.string().trim().max(500).default(""),
  subscribed: z.boolean().default(true),
});

export const saveNewsletterSubscriber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => upsertSchema.parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const payload = {
      name: data.name,
      email: data.email.toLowerCase(),
      note: data.note,
      subscribed: data.subscribed,
    };
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("newsletter_subscribers")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("newsletter_subscribers")
        .insert({ ...payload, source: "manual" });
      if (error) throw new Error(error.message.includes("duplicate") ? "Diese E-Mail-Adresse ist bereits erfasst." : error.message);
    }
    return { ok: true };
  });

export const deleteNewsletterSubscriber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("newsletter_subscribers")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Übernimmt Namen + E-Mail aus allen Reservierungen (ohne Duplikate)
export const importFromReservations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const { data: res, error } = await supabaseAdmin
      .from("reservations")
      .select("guest_name, guest_email, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const { data: existingRows, error: exErr } = await supabaseAdmin
      .from("newsletter_subscribers")
      .select("email");
    if (exErr) throw new Error(exErr.message);
    const existing = new Set((existingRows ?? []).map((r) => r.email.toLowerCase()));

    const toInsert: { name: string; email: string; source: string }[] = [];
    const seen = new Set<string>();
    for (const r of res ?? []) {
      const email = (r.guest_email ?? "").trim().toLowerCase();
      if (!email || !email.includes("@")) continue;
      if (existing.has(email) || seen.has(email)) continue;
      seen.add(email);
      toInsert.push({ name: (r.guest_name ?? "").trim(), email, source: "reservation" });
    }
    if (toInsert.length > 0) {
      const { error: insErr } = await supabaseAdmin
        .from("newsletter_subscribers")
        .insert(toInsert);
      if (insErr) throw new Error(insErr.message);
    }
    return { added: toInsert.length, skipped: (res?.length ?? 0) - toInsert.length };
  });
