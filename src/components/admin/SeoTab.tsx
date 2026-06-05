import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Loader2, Gauge } from "lucide-react";
import { analyzeSeoPage, listSeoSettings, updateSeoSetting, type SeoCheck } from "@/lib/admin.functions";
import { toast } from "sonner";

type Row = {
  path: string;
  label: string;
  title: string;
  description: string;
  og_image: string;
};

type Analysis = {
  url: string;
  status: number;
  loadMs: number;
  score: number;
  checks: SeoCheck[];
  title: string;
  description: string;
  ogImage: string;
  h1: string;
  error?: string;
};

export function SeoTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listSeoSettings);
  const updFn = useServerFn(updateSeoSetting);
  const analyzeFn = useServerFn(analyzeSeoPage);
  const { data, isLoading } = useQuery({ queryKey: ["seo-settings"], queryFn: () => listFn() });
  const [rows, setRows] = useState<Row[]>([]);
  const [savingPath, setSavingPath] = useState<string | null>(null);
  const [analyses, setAnalyses] = useState<Record<string, Analysis>>({});
  const [analyzing, setAnalyzing] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (data) setRows(data as Row[]);
  }, [data]);

  function update(path: string, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.path === path ? { ...r, ...patch } : r)));
  }

  async function save(row: Row) {
    setSavingPath(row.path);
    try {
      await updFn({ data: { path: row.path, title: row.title, description: row.description, og_image: row.og_image } });
      toast.success(`SEO für ${row.label || row.path} gespeichert`);
      qc.invalidateQueries({ queryKey: ["public-data"] });
      qc.invalidateQueries({ queryKey: ["seo-settings"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler");
    } finally {
      setSavingPath(null);
    }
  }

  async function analyze(row: Row) {
    setAnalyzing((m) => ({ ...m, [row.path]: true }));
    try {
      const res = (await analyzeFn({ data: { path: row.path } })) as Analysis;
      setAnalyses((m) => ({ ...m, [row.path]: res }));
      if (res.error) toast.error(`Analyse fehlgeschlagen: ${res.error}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analyse fehlgeschlagen");
    } finally {
      setAnalyzing((m) => ({ ...m, [row.path]: false }));
    }
  }

  async function analyzeAll() {
    for (const r of rows) await analyze(r);
  }

  if (isLoading) return <p className="text-muted-foreground">Lade …</p>;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-2xl mb-2">SEO Optimierung</h2>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Titel, Beschreibung und Vorschaubild für Google, Facebook, WhatsApp & Co. – pro Seite.
            Mit <strong>Analysieren</strong> prüfst du jede Seite live: HTTP-Status, Ladezeit, H1, Open-Graph-Bild,
            Mobile-Tauglichkeit, alt-Texte uvm. → Qualitäts-Score 0-100.
          </p>
        </div>
        <button
          onClick={analyzeAll}
          className="rounded-full border border-border px-5 py-2 text-xs uppercase tracking-widest hover:bg-secondary"
        >
          Alle analysieren
        </button>
      </div>

      <RankingsBanner />

      {rows.map((row) => {
        const titleLen = row.title.length;
        const descLen = row.description.length;
        const ana = analyses[row.path];
        const isAnalyzing = !!analyzing[row.path];
        return (
          <div key={row.path} className="bg-card border border-border rounded-sm p-6">
            <div className="flex items-baseline justify-between mb-4 gap-4 flex-wrap">
              <div>
                <h3 className="font-display text-lg">{row.label || row.path}</h3>
                <code className="text-xs text-muted-foreground">{row.path}</code>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => analyze(row)}
                  disabled={isAnalyzing}
                  className="rounded-full border border-border px-4 py-2 text-xs uppercase tracking-widest hover:bg-secondary disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {isAnalyzing ? <Loader2 className="size-3 animate-spin" /> : <Gauge className="size-3" />}
                  {isAnalyzing ? "Analysiere …" : ana ? "Neu analysieren" : "Analysieren"}
                </button>
                <button
                  onClick={() => save(row)}
                  disabled={savingPath === row.path}
                  className="rounded-full bg-gold px-5 py-2 text-xs uppercase tracking-widest text-gold-foreground disabled:opacity-50"
                >
                  {savingPath === row.path ? "Speichere …" : "Speichern"}
                </button>
              </div>
            </div>

            {ana && !ana.error && <ScorePanel ana={ana} />}

            <div className="grid gap-4 mt-4">
              <Field label={`Seiten-Titel (${titleLen}/60)`} warn={titleLen > 65}>
                <input
                  type="text"
                  value={row.title}
                  maxLength={180}
                  onChange={(e) => update(row.path, { title: e.target.value })}
                  className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>

              <Field label={`Meta-Beschreibung (${descLen}/160)`} warn={descLen > 170}>
                <textarea
                  value={row.description}
                  maxLength={400}
                  rows={2}
                  onChange={(e) => update(row.path, { description: e.target.value })}
                  className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm resize-y"
                />
              </Field>

              <Field label="Vorschaubild URL (Open Graph) — optional">
                <input
                  type="url"
                  placeholder="https://…"
                  value={row.og_image}
                  onChange={(e) => update(row.path, { og_image: e.target.value })}
                  className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm"
                />
                {row.og_image && (
                  <img src={row.og_image} alt="" className="mt-2 h-24 w-auto rounded-sm border border-border object-cover" />
                )}
              </Field>

              <div className="mt-2 border border-border rounded-sm p-4 bg-background">
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">Google Vorschau</div>
                <div className="text-xs text-emerald-700">https://balkaneros.oaase.com{row.path === "/" ? "" : row.path}</div>
                <div className="text-blue-700 text-lg leading-snug truncate">{row.title || "(Kein Titel)"}</div>
                <div className="text-sm text-muted-foreground line-clamp-2">{row.description || "(Keine Beschreibung)"}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ScorePanel({ ana }: { ana: Analysis }) {
  const color =
    ana.score >= 85 ? "text-emerald-600" : ana.score >= 65 ? "text-amber-600" : "text-destructive";
  const ring =
    ana.score >= 85 ? "border-emerald-600" : ana.score >= 65 ? "border-amber-600" : "border-destructive";
  return (
    <div className="border border-border rounded-sm p-4 bg-background">
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <div className={`size-16 rounded-full border-4 ${ring} flex items-center justify-center font-display text-xl ${color}`}>
          {ana.score}
        </div>
        <div className="text-xs text-muted-foreground space-y-1">
          <div>
            Status: <span className="font-mono">{ana.status}</span> · Ladezeit:{" "}
            <span className="font-mono">{ana.loadMs} ms</span>
          </div>
          <div className="truncate max-w-md">
            URL: <a href={ana.url} target="_blank" rel="noreferrer" className="underline">{ana.url}</a>
          </div>
        </div>
      </div>
      <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
        {ana.checks.map((c) => (
          <li key={c.id} className="flex items-start gap-2 text-xs">
            {c.status === "ok" && <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />}
            {c.status === "warn" && <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />}
            {c.status === "fail" && <XCircle className="size-4 text-destructive shrink-0 mt-0.5" />}
            <div className="min-w-0">
              <div className="font-medium">{c.label}</div>
              <div className="text-muted-foreground truncate">{c.detail}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RankingsBanner() {
  return (
    <div className="border border-dashed border-border rounded-sm p-5 bg-background">
      <div className="flex items-start gap-3">
        <Gauge className="size-5 text-gold shrink-0 mt-0.5" />
        <div className="text-sm space-y-1">
          <div className="font-display text-base">Echte Google-Rankings & Authority-Daten</div>
          <p className="text-muted-foreground">
            Für Live-Position in Google, Klicks/Impressions und Wettbewerbs-Daten verbinde
            <strong> Google Search Console</strong> (kostenlos) und <strong>Semrush</strong>.
            Sobald verbunden, erscheinen hier pro Seite die echten Suchpositionen, Top-Keywords und der Authority Score.
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, warn, children }: { label: string; warn?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={`block text-xs uppercase tracking-widest mb-1 ${warn ? "text-destructive" : "text-muted-foreground"}`}>{label}</span>
      {children}
    </label>
  );
}
