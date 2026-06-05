// Server-only helpers for site content + signed image URLs.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SIGN_EXPIRY = 60 * 60 * 24 * 7; // 7 days

export async function signImageValue(value: string): Promise<string> {
  if (!value) return "";
  if (/^https?:\/\//.test(value)) return value;
  // value is a storage path inside the site-images bucket
  const { data } = await supabaseAdmin.storage.from("site-images").createSignedUrl(value, SIGN_EXPIRY);
  return data?.signedUrl ?? "";
}

export type SiteContentRow = {
  key: string;
  value: string;
  label: string;
  kind: string;
  sort_order: number;
};

export async function loadSiteContent(): Promise<Record<string, string>> {
  const { data, error } = await supabaseAdmin
    .from("site_content")
    .select("key, value, kind")
    .order("sort_order");
  if (error) throw new Error(error.message);
  const out: Record<string, string> = {};
  for (const row of data ?? []) {
    if (row.kind === "image") {
      out[row.key] = await signImageValue(row.value);
    } else {
      out[row.key] = row.value;
    }
  }
  return out;
}

export type SeoRow = {
  path: string;
  label: string;
  title: string;
  description: string;
  og_image: string;
};

export async function loadSeoSettings(): Promise<Record<string, SeoRow>> {
  const { data, error } = await supabaseAdmin
    .from("seo_settings")
    .select("path, label, title, description, og_image")
    .order("sort_order");
  if (error) throw new Error(error.message);
  const out: Record<string, SeoRow> = {};
  for (const r of data ?? []) out[r.path] = r as SeoRow;
  return out;
}
