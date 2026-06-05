import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin } from "./admin.server";

// ---- Track a page view (public) ----
const trackSchema = z.object({
  path: z.string().min(1).max(500),
  referrer: z.string().max(500).optional().default(""),
  session_id: z.string().max(64).optional().default(""),
  device: z.enum(["mobile", "tablet", "desktop", "unknown"]).optional().default("unknown"),
});

export const trackPageView = createServerFn({ method: "POST" })
  .inputValidator((i) => trackSchema.parse(i))
  .handler(async ({ data }) => {
    // Ignore admin/auth/internal paths
    if (/^\/(admin|auth|api)(\/|$)/.test(data.path)) return { ok: true, skipped: true };
    const { error } = await supabaseAdmin.from("page_views").insert({
      path: data.path,
      referrer: data.referrer ?? "",
      session_id: data.session_id ?? "",
      device: data.device ?? "unknown",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- Read analytics (admin) ----
const rangeSchema = z.object({
  days: z.number().int().min(1).max(365).optional().default(30),
});

export type AnalyticsSummary = {
  days: number;
  totals: { views: number; visitors: number; avgPerDay: number };
  today: { views: number; visitors: number };
  yesterday: { views: number; visitors: number };
  series: { date: string; views: number; visitors: number }[];
  topPages: { path: string; views: number; visitors: number }[];
  topReferrers: { referrer: string; views: number }[];
  devices: { device: string; views: number }[];
  liveActive: number; // sessions seen in last 5 minutes
};

export const getAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => rangeSchema.parse(i ?? {}))
  .handler(async ({ data, context }): Promise<AnalyticsSummary> => {
    await requireAdmin(context.userId);
    const since = new Date();
    since.setDate(since.getDate() - (data.days - 1));
    since.setHours(0, 0, 0, 0);

    const { data: rows, error } = await supabaseAdmin
      .from("page_views")
      .select("path, referrer, session_id, device, created_at")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(50000);
    if (error) throw new Error(error.message);
    const list = rows ?? [];

    // Build day buckets
    const dayKeys: string[] = [];
    for (let i = 0; i < data.days; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      dayKeys.push(d.toISOString().slice(0, 10));
    }
    const dayMap = new Map<string, { views: number; visitors: Set<string> }>();
    dayKeys.forEach((k) => dayMap.set(k, { views: 0, visitors: new Set() }));

    const pageMap = new Map<string, { views: number; visitors: Set<string> }>();
    const refMap = new Map<string, number>();
    const devMap = new Map<string, number>();
    const sessionsAll = new Set<string>();
    const liveCutoff = Date.now() - 5 * 60 * 1000;
    const liveSessions = new Set<string>();

    const todayKey = new Date().toISOString().slice(0, 10);
    const yKey = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })();

    for (const r of list) {
      const k = r.created_at.slice(0, 10);
      const day = dayMap.get(k);
      const sid = r.session_id || `anon:${r.created_at}`;
      if (day) { day.views++; day.visitors.add(sid); }

      const p = pageMap.get(r.path) ?? { views: 0, visitors: new Set<string>() };
      p.views++; p.visitors.add(sid); pageMap.set(r.path, p);

      const ref = normalizeRef(r.referrer);
      refMap.set(ref, (refMap.get(ref) ?? 0) + 1);

      devMap.set(r.device || "unknown", (devMap.get(r.device || "unknown") ?? 0) + 1);
      sessionsAll.add(sid);

      if (new Date(r.created_at).getTime() >= liveCutoff) liveSessions.add(sid);
    }

    const series = dayKeys.map((k) => {
      const v = dayMap.get(k)!;
      return { date: k, views: v.views, visitors: v.visitors.size };
    });

    const totals = {
      views: list.length,
      visitors: sessionsAll.size,
      avgPerDay: Math.round(list.length / data.days),
    };

    const today = series.find((s) => s.date === todayKey) ?? { date: todayKey, views: 0, visitors: 0 };
    const yesterday = series.find((s) => s.date === yKey) ?? { date: yKey, views: 0, visitors: 0 };

    const topPages = [...pageMap.entries()]
      .map(([path, v]) => ({ path, views: v.views, visitors: v.visitors.size }))
      .sort((a, b) => b.views - a.views).slice(0, 10);

    const topReferrers = [...refMap.entries()]
      .map(([referrer, views]) => ({ referrer, views }))
      .sort((a, b) => b.views - a.views).slice(0, 10);

    const devices = [...devMap.entries()]
      .map(([device, views]) => ({ device, views }))
      .sort((a, b) => b.views - a.views);

    return {
      days: data.days,
      totals,
      today: { views: today.views, visitors: today.visitors },
      yesterday: { views: yesterday.views, visitors: yesterday.visitors },
      series,
      topPages,
      topReferrers,
      devices,
      liveActive: liveSessions.size,
    };
  });

function normalizeRef(r: string): string {
  if (!r) return "Direkt";
  try {
    const u = new URL(r);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return r.slice(0, 60);
  }
}
