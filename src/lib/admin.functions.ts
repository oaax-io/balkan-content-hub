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
  hours_public_visible: z.boolean(),
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

// ---- SEO settings ----
export const listSeoSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("seo_settings").select("*").order("sort_order");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const seoSchema = z.object({
  path: z.string().min(1).max(120),
  title: z.string().trim().max(180),
  description: z.string().trim().max(400),
  og_image: z.string().trim().max(1000),
});
export const updateSeoSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => seoSchema.parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("seo_settings")
      .update({ title: data.title, description: data.description, og_image: data.og_image, updated_at: new Date().toISOString() })
      .eq("path", data.path);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- On-Page SEO quality analyzer ----
const analyzeSchema = z.object({ path: z.string().min(1).max(120) });

export type SeoCheck = {
  id: string;
  label: string;
  status: "ok" | "warn" | "fail";
  detail: string;
  weight: number;
};

export const analyzeSeoPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => analyzeSchema.parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const base = "https://balkaneros.oaase.com";
    const url = base + (data.path === "/" ? "" : data.path);
    const started = Date.now();
    let html = "";
    let status = 0;
    let ok = false;
    let bytes = 0;
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Lovable-SEO-Bot/1.0 (+admin)" } });
      status = res.status;
      ok = res.ok;
      html = await res.text();
      bytes = html.length;
    } catch (e) {
      return {
        url,
        error: e instanceof Error ? e.message : "fetch_failed",
        score: 0,
        status: 0,
        loadMs: Date.now() - started,
        checks: [] as SeoCheck[],
        title: "",
        description: "",
        ogImage: "",
        h1: "",
      };
    }
    const loadMs = Date.now() - started;

    const pick = (re: RegExp) => {
      const m = html.match(re);
      return m ? m[1].trim() : "";
    };
    const title = pick(/<title[^>]*>([^<]*)<\/title>/i);
    const desc = pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i);
    const ogTitle = pick(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i);
    const ogDesc = pick(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i);
    const ogImage = pick(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)["']/i);
    const canonical = pick(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i);
    const viewport = pick(/<meta[^>]+name=["']viewport["'][^>]+content=["']([^"']*)["']/i);
    const lang = pick(/<html[^>]+lang=["']([^"']*)["']/i);
    const h1Matches = html.match(/<h1[\s>][\s\S]*?<\/h1>/gi) || [];
    const h1Count = h1Matches.length;
    const h1Text = h1Matches[0]?.replace(/<[^>]+>/g, "").trim() ?? "";
    const imgs = html.match(/<img\b[^>]*>/gi) || [];
    const imgsNoAlt = imgs.filter((t) => !/\salt\s*=/i.test(t)).length;
    const isHttps = url.startsWith("https://");

    const mk = (id: string, label: string, cond: boolean, detail: string, weight: number, warnCond = false): SeoCheck => ({
      id,
      label,
      status: cond ? "ok" : warnCond ? "warn" : "fail",
      detail,
      weight,
    });

    const checks: SeoCheck[] = [
      mk("status", "HTTP Status 200", ok && status === 200, String(status || "—"), 15),
      mk("https", "HTTPS aktiv", isHttps, isHttps ? "ja" : "nein", 5),
      mk("load", "Ladezeit < 1.5 s", loadMs < 1500, `${loadMs} ms`, 8, loadMs < 3000),
      mk("title", "Titel vorhanden", !!title, title || "fehlt", 10),
      mk("titleLen", "Titel 30–60 Zeichen", title.length >= 30 && title.length <= 60, `${title.length} Zeichen`, 6, title.length > 0 && title.length <= 70),
      mk("desc", "Meta-Beschreibung vorhanden", !!desc, desc ? `${desc.length} Zeichen` : "fehlt", 8),
      mk("descLen", "Beschreibung 120–160 Zeichen", desc.length >= 120 && desc.length <= 160, `${desc.length} Zeichen`, 5, desc.length > 0 && desc.length <= 175),
      mk("h1", "Genau eine H1-Überschrift", h1Count === 1, `${h1Count} gefunden${h1Text ? ` – „${h1Text.slice(0, 60)}"` : ""}`, 8, h1Count > 1),
      mk("canonical", "Canonical-URL gesetzt", !!canonical, canonical || "fehlt", 5),
      mk("ogTitle", "Open Graph Titel", !!ogTitle, ogTitle ? "ok" : "fehlt", 4),
      mk("ogDesc", "Open Graph Beschreibung", !!ogDesc, ogDesc ? "ok" : "fehlt", 4),
      mk("ogImage", "Open Graph Bild (Social-Vorschau)", !!ogImage, ogImage ? "vorhanden" : "fehlt – Vorschau ohne Bild", 8),
      mk("viewport", "Mobile Viewport Meta", !!viewport, viewport ? "ok" : "fehlt", 4),
      mk("lang", "HTML Sprach-Attribut", !!lang, lang || "fehlt", 3),
      mk("imgAlt", "Bilder mit alt-Text", imgsNoAlt === 0, `${imgs.length - imgsNoAlt}/${imgs.length} mit alt`, 4, imgsNoAlt > 0 && imgsNoAlt <= 3),
      mk("size", "Seitengrösse < 800 KB", bytes < 800_000, `${Math.round(bytes / 1024)} KB`, 3, bytes < 2_000_000),
    ];

    const total = checks.reduce((s, c) => s + c.weight, 0);
    const got = checks.reduce((s, c) => s + (c.status === "ok" ? c.weight : c.status === "warn" ? c.weight * 0.5 : 0), 0);
    const score = Math.round((got / total) * 100);

    return { url, status, loadMs, score, checks, title, description: desc, ogImage, h1: h1Text };
  });
