import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getAnalytics } from "@/lib/analytics.functions";
import { Users, Eye, TrendingUp, TrendingDown, Activity, Monitor, Smartphone, Tablet, HelpCircle } from "lucide-react";

const RANGES = [
  { label: "7 T", days: 7 },
  { label: "30 T", days: 30 },
  { label: "90 T", days: 90 },
];

export function AnalyticsTab() {
  const [days, setDays] = useState(30);
  const fn = useServerFn(getAnalytics);
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["analytics", days],
    queryFn: () => fn({ data: { days } }),
    refetchInterval: 60_000,
  });

  if (isLoading) return <p className="text-muted-foreground">Lade …</p>;
  if (!data) return <p className="text-muted-foreground">Keine Daten.</p>;

  const trend = data.yesterday.views > 0
    ? Math.round(((data.today.views - data.yesterday.views) / data.yesterday.views) * 100)
    : data.today.views > 0 ? 100 : 0;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl">Website Analytics</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Besucher, Seitenaufrufe und Quellen deiner Website.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 mr-2 text-xs text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <strong className="text-foreground">{data.liveActive}</strong> aktiv jetzt
          </div>
          {RANGES.map((r) => (
            <button key={r.days} onClick={() => setDays(r.days)}
              className={`px-3 py-1.5 text-xs rounded-full border transition ${
                days === r.days
                  ? "bg-gold text-gold-foreground border-gold"
                  : "border-border text-muted-foreground hover:border-gold"
              }`}>
              {r.label}
            </button>
          ))}
          <button onClick={() => refetch()} disabled={isFetching}
            className="px-3 py-1.5 text-xs rounded-full border border-border text-muted-foreground hover:border-gold disabled:opacity-50">
            {isFetching ? "…" : "Aktualisieren"}
          </button>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Eye} label="Seitenaufrufe" value={data.totals.views.toLocaleString("de-CH")} hint={`Letzte ${data.days} Tage`} />
        <Stat icon={Users} label="Besucher" value={data.totals.visitors.toLocaleString("de-CH")} hint="Unique Sessions" />
        <Stat icon={Activity} label="Ø pro Tag" value={data.totals.avgPerDay.toLocaleString("de-CH")} hint="Aufrufe / Tag" />
        <Stat
          icon={trend >= 0 ? TrendingUp : TrendingDown}
          label="Heute vs. Gestern"
          value={`${trend >= 0 ? "+" : ""}${trend}%`}
          hint={`${data.today.views} heute · ${data.yesterday.views} gestern`}
          accent={trend >= 0 ? "good" : "bad"}
        />
      </div>

      <Card title="Verlauf" subtitle="Tägliche Aufrufe & Besucher">
        <Chart series={data.series} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Top Seiten" subtitle="Meistbesuchte Seiten">
          {data.topPages.length === 0 ? (
            <Empty />
          ) : (
            <ul className="divide-y divide-border">
              {data.topPages.map((p) => {
                const max = data.topPages[0].views || 1;
                const pct = (p.views / max) * 100;
                return (
                  <li key={p.path} className="py-2.5">
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      <span className="text-sm font-medium truncate">{p.path === "/" ? "/ (Start)" : p.path}</span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {p.views.toLocaleString("de-CH")} · {p.visitors} Besucher
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-gold" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Quellen" subtitle="Woher kommen die Besucher">
          {data.topReferrers.length === 0 ? (
            <Empty />
          ) : (
            <ul className="divide-y divide-border">
              {data.topReferrers.map((r) => {
                const max = data.topReferrers[0].views || 1;
                const pct = (r.views / max) * 100;
                return (
                  <li key={r.referrer} className="py-2.5">
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      <span className="text-sm font-medium truncate">{r.referrer}</span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{r.views.toLocaleString("de-CH")}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-foreground/60" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Geräte" subtitle="Verteilung nach Bildschirmgrösse">
        <div className="grid gap-3 sm:grid-cols-4">
          {(["desktop", "mobile", "tablet", "unknown"] as const).map((d) => {
            const row = data.devices.find((x) => x.device === d);
            const total = data.totals.views || 1;
            const pct = Math.round(((row?.views ?? 0) / total) * 100);
            const Icon = d === "desktop" ? Monitor : d === "mobile" ? Smartphone : d === "tablet" ? Tablet : HelpCircle;
            const label = d === "desktop" ? "Desktop" : d === "mobile" ? "Mobil" : d === "tablet" ? "Tablet" : "Unbekannt";
            return (
              <div key={d} className="rounded-sm border border-border p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
                  <Icon className="w-3.5 h-3.5" /> {label}
                </div>
                <div className="text-2xl font-display">{pct}%</div>
                <div className="text-xs text-muted-foreground mt-1">{(row?.views ?? 0).toLocaleString("de-CH")} Aufrufe</div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function Stat({ icon: Icon, label, value, hint, accent }: {
  icon: typeof Eye; label: string; value: string; hint: string; accent?: "good" | "bad";
}) {
  const accentClass = accent === "good" ? "text-emerald-600" : accent === "bad" ? "text-red-600" : "text-foreground";
  return (
    <div className="rounded-sm border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
        <Icon className={`w-4 h-4 ${accentClass}`} />
      </div>
      <div className={`text-3xl font-display ${accentClass}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{hint}</div>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-sm border border-border bg-card p-6">
      <header className="mb-4">
        <h3 className="font-display text-xl">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}

function Empty() {
  return <p className="text-sm text-muted-foreground py-6 text-center">Noch keine Daten in diesem Zeitraum.</p>;
}

function Chart({ series }: { series: { date: string; views: number; visitors: number }[] }) {
  const max = Math.max(1, ...series.map((s) => s.views));
  const showEvery = Math.max(1, Math.ceil(series.length / 10));
  return (
    <div>
      <div className="flex items-end gap-1 h-48">
        {series.map((s) => {
          const h = (s.views / max) * 100;
          const vh = (s.visitors / max) * 100;
          return (
            <div key={s.date} className="flex-1 flex flex-col items-center justify-end group relative">
              <div className="w-full bg-gold/30 rounded-t-sm" style={{ height: `${h}%` }}>
                <div className="w-full bg-gold rounded-t-sm" style={{ height: `${(vh / Math.max(h, 1)) * 100}%` }} />
              </div>
              <div className="absolute -top-10 hidden group-hover:block bg-popover border border-border rounded px-2 py-1 text-[10px] whitespace-nowrap z-10 shadow">
                <div className="font-medium">{new Date(s.date).toLocaleDateString("de-CH")}</div>
                <div>{s.views} Aufrufe · {s.visitors} Besucher</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-2">
        {series.map((s, i) => (
          <span key={s.date} className="flex-1 text-center">
            {i % showEvery === 0 ? new Date(s.date).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit" }) : ""}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-gold rounded-sm" /> Besucher</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-gold/30 rounded-sm" /> Aufrufe</span>
      </div>
    </div>
  );
}
