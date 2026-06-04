import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin } from "./admin.server";
import { signImageValue } from "./site.server";

// ---- check current user is admin ----
export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await supabaseAdmin
      .from("user_roles").select("role")
      .eq("user_id", context.userId).eq("role", "admin").maybeSingle();
    return { isAdmin: !!data };
  });

// ---- list site content for admin (raw values, no signing) + signed previews ----
export const listSiteContent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("site_content").select("*").order("sort_order");
    if (error) throw new Error(error.message);
    const rows = await Promise.all((data ?? []).map(async (r) => ({
      ...r,
      preview_url: r.kind === "image" ? await signImageValue(r.value) : "",
    })));
    return rows;
  });

const updateContentSchema = z.object({
  key: z.string().min(1).max(80),
  value: z.string().max(5000),
});
export const updateSiteContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => updateContentSchema.parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("site_content").update({ value: data.value }).eq("key", data.key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- image upload (base64 data URL) ----
const uploadSchema = z.object({
  key: z.string().min(1).max(80),
  filename: z.string().min(1).max(120),
  data_base64: z.string().min(10),
  content_type: z.string().min(1).max(100),
});
export const uploadSiteImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => uploadSchema.parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const ext = data.filename.split(".").pop() || "jpg";
    const path = `${data.key}-${Date.now()}.${ext}`;
    const buffer = Uint8Array.from(atob(data.data_base64), (c) => c.charCodeAt(0));
    const { error: upErr } = await supabaseAdmin.storage
      .from("site-images")
      .upload(path, buffer, { contentType: data.content_type, upsert: true });
    if (upErr) throw new Error(upErr.message);
    const { error: dbErr } = await supabaseAdmin
      .from("site_content").update({ value: path }).eq("key", data.key);
    if (dbErr) throw new Error(dbErr.message);
    const { data: signed } = await supabaseAdmin.storage
      .from("site-images").createSignedUrl(path, 60 * 60 * 24 * 7);
    return { path, preview_url: signed?.signedUrl ?? "" };
  });

// ---- contact info ----
export const getContactInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const { data, error } = await supabaseAdmin.from("contact_info").select("*").eq("id", 1).single();
    if (error) throw new Error(error.message);
    return data;
  });

const contactSchema = z.object({
  restaurant_name: z.string().trim().max(120),
  address_line1: z.string().trim().max(200),
  address_line2: z.string().trim().max(200),
  city: z.string().trim().max(120),
  postal_code: z.string().trim().max(20),
  phone: z.string().trim().max(40),
  email: z.string().trim().max(255),
  notification_email: z.string().trim().max(255),
  instagram_url: z.string().trim().max(500),
  facebook_url: z.string().trim().max(500),
  maps_embed_url: z.string().trim().max(2000),
});
export const updateContactInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => contactSchema.parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { error } = await supabaseAdmin.from("contact_info").update(data).eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- opening hours ----
const hoursSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  is_closed: z.boolean(),
  open_time: z.string().max(10),
  close_time: z.string().max(10),
  note: z.string().max(200),
});
export const updateOpeningHour = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => hoursSchema.parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { error } = await supabaseAdmin.from("opening_hours")
      .update({ is_closed: data.is_closed, open_time: data.open_time, close_time: data.close_time, note: data.note })
      .eq("weekday", data.weekday);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- promote current user to admin if no admin exists yet ----
export const claimAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count } = await supabaseAdmin
      .from("user_roles").select("*", { count: "exact", head: true }).eq("role", "admin");
    if ((count ?? 0) > 0) return { ok: false, reason: "admin_exists" as const };
    const { error } = await supabaseAdmin
      .from("user_roles").insert({ user_id: context.userId, role: "admin" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
