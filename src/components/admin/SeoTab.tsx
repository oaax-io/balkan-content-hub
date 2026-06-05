import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { listSeoSettings, updateSeoSetting } from "@/lib/admin.functions";
import { toast } from "sonner";

type Row = {
  path: string;
  label: string;
  title: string;
  description: string;
  og_image: string;
};

export function SeoTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listSeoSettings);
  const updFn = useServerFn(updateSeoSetting);
  const { data, isLoading } = useQuery({ queryKey: ["seo-settings"], queryFn: () => listFn() });
  const [rows, setRows] = useState<Row[]>([]);
  const [savingPath, setSavingPath] = useState<string | null>(null);

  useEffect(() => { if (data) setRows(data as Row[]); }, [data]);

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

  if (isLoading) return <p className="text-muted-foreground">Lade …</p>;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl mb-2">SEO Optimierung</h2>
        <p className="text-sm text-muted-foreground">
          Titel, Beschreibung und Vorschaubild für Google, Facebook, WhatsApp & Co. – pro Seite. Empfohlen: Titel max. ~60 Zeichen, Beschreibung max. ~160 Zeichen.
        </p>
      </div>

      {rows.map((row) => {
        const titleLen = row.title.length;
        const descLen = row.description.length;
        return (
          <div key={row.path} className="bg-card border border-border rounded-sm p-6">
            <div className="flex items-baseline justify-between mb-4 gap-4 flex-wrap">
              <div>
                <h3 className="font-display text-lg">{row.label || row.path}</h3>
                <code className="text-xs text-muted-foreground">{row.path}</code>
              </div>
              <button
                onClick={() => save(row)}
                disabled={savingPath === row.path}
                className="rounded-full bg-gold px-5 py-2 text-xs uppercase tracking-widest text-gold-foreground disabled:opacity-50"
              >
                {savingPath === row.path ? "Speichere …" : "Speichern"}
              </button>
            </div>

            <div className="grid gap-4">
              <Field
                label={`Seiten-Titel (${titleLen}/60)`}
                warn={titleLen > 65}
              >
                <input
                  type="text"
                  value={row.title}
                  maxLength={180}
                  onChange={(e) => update(row.path, { title: e.target.value })}
                  className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>

              <Field
                label={`Meta-Beschreibung (${descLen}/160)`}
                warn={descLen > 170}
              >
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

              {/* Google Vorschau */}
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

function Field({ label, warn, children }: { label: string; warn?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={`block text-xs uppercase tracking-widest mb-1 ${warn ? "text-destructive" : "text-muted-foreground"}`}>{label}</span>
      {children}
    </label>
  );
}
