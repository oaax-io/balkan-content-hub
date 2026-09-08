import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listReservations, listOccasionCapacities, setOccasionCapacity } from "@/lib/reservations.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save, Users } from "lucide-react";

export const OCCASION_LABEL_FALLBACK = "Kein Anlass angegeben";

export type OccRow = {
  name: string; reservations: number; persons: number;
  max: number; remaining: number; pct: number; isConfigured: boolean;
};

export function useOccasionLoad() {
  const listFn = useServerFn(listReservations);
  const capListFn = useServerFn(listOccasionCapacities);

  const { data: reservations, isLoading } = useQuery({ queryKey: ["reservations"], queryFn: () => listFn() });
  const { data: capacities } = useQuery({ queryKey: ["occasion-capacities"], queryFn: () => capListFn() });
  const { data: occasionsList } = useQuery({
    queryKey: ["occasions-from-content"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_content").select("value").eq("key", "reservation_occasions").maybeSingle();
      if (error) return [] as string[];
      return ((data?.value as string | undefined) ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
    },
  });

  const all = reservations ?? [];
  const active = all.filter((r) => r.status !== "declined" && r.status !== "cancelled");

  const keys = new Set<string>();
  (occasionsList ?? []).forEach((o) => keys.add(o));
  active.forEach((r) => keys.add((r.occasion || "").trim() || OCCASION_LABEL_FALLBACK));
  (capacities ?? []).forEach((c) => keys.add(c.occasion));

  const capMap = new Map<string, number>();
  (capacities ?? []).forEach((c) => capMap.set(c.occasion, c.max_reservations));

  const rows: OccRow[] = Array.from(keys).map((name) => {
    const matches = active.filter((r) => ((r.occasion || "").trim() || OCCASION_LABEL_FALLBACK) === name);
    const reservationsCount = matches.length;
    const persons = matches.reduce((s, r) => s + (r.party_size || 0), 0);
    const max = capMap.get(name) ?? 0;
    const remaining = max > 0 ? Math.max(0, max - reservationsCount) : 0;
    const pct = max > 0 ? Math.min(100, Math.round((reservationsCount / max) * 100)) : 0;
    const isConfigured = !!(occasionsList ?? []).includes(name);
    return { name, reservations: reservationsCount, persons, max, remaining, pct, isConfigured };
  }).sort((a, b) => b.reservations - a.reservations || a.name.localeCompare(b.name));

  return { rows, isLoading };
}

export function barColor(pct: number) {
  return pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500";
}

/** Full editable table — used inside the "Formular bearbeiten" dialog. */
export function OccasionLoadPanel({ onFilterByOccasion }: { onFilterByOccasion?: (name: string) => void }) {
  const { rows, isLoading } = useOccasionLoad();
  const setCapFn = useServerFn(setOccasionCapacity);
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  async function save(name: string) {
    const n = Number(drafts[name]);
    if (!Number.isFinite(n) || n < 0) { toast.error("Bitte eine Zahl ≥ 0 eingeben."); return; }
    setSavingKey(name);
    try {
      await setCapFn({ data: { occasion: name, max_reservations: Math.floor(n) } });
      toast.success(`Maximum für „${name}" gespeichert.`);
      setDrafts((d) => { const c = { ...d }; delete c[name]; return c; });
      qc.invalidateQueries({ queryKey: ["occasion-capacities"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Fehler"); }
    finally { setSavingKey(null); }
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Lade …</p>;
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground italic">Noch keine Anlässe konfiguriert.</p>;
  }

  const totalRes = rows.reduce((s, r) => s + r.reservations, 0);
  const totalPersons = rows.reduce((s, r) => s + r.persons, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Users className="h-3.5 w-3.5" />
        {rows.length} Anlass{rows.length === 1 ? "" : "e"} · {totalRes} Reservierungen · {totalPersons} Personen
      </div>

      <div className="overflow-x-auto rounded-md border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-widest text-muted-foreground">
            <tr className="border-b border-border">
              <th className="py-2 pl-3 pr-4 text-left font-medium">Anlass</th>
              <th className="px-2 py-2 text-right font-medium">Res.</th>
              <th className="px-2 py-2 text-right font-medium">Personen</th>
              <th className="w-1/3 px-2 py-2 text-left font-medium">Auslastung</th>
              <th className="px-2 py-2 text-right font-medium">Max</th>
              <th className="py-2 pl-2 pr-3 text-right font-medium">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const draft = drafts[r.name];
              const editing = draft !== undefined;
              return (
                <tr key={r.name} className="border-b border-border last:border-0">
                  <td className="py-2.5 pl-3 pr-4">
                    <button type="button" onClick={() => onFilterByOccasion?.(r.name)} className="text-left hover:text-gold">
                      <div className="font-medium">{r.name}</div>
                      {!r.isConfigured && (
                        <div className="mt-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">nicht in Dropdown</div>
                      )}
                    </button>
                  </td>
                  <td className="px-2 py-2.5 text-right font-display text-base tabular-nums">{r.reservations}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">
                    <span className="inline-flex items-center gap-1 text-foreground">
                      <Users className="h-3 w-3 text-muted-foreground" />{r.persons}
                    </span>
                  </td>
                  <td className="px-2 py-2.5">
                    {r.max > 0 ? (
                      <div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div className={`h-full ${barColor(r.pct)} transition-all`} style={{ width: `${r.pct}%` }} />
                        </div>
                        <div className="mt-1 text-[10px] text-muted-foreground">
                          {r.pct}% · {r.remaining > 0 ? `noch ${r.remaining} frei` : "ausgebucht"}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs italic text-muted-foreground">kein Limit</span>
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    <input
                      type="number" min={0} inputMode="numeric"
                      value={editing ? draft : (r.max || "")}
                      placeholder="—"
                      onChange={(e) => setDrafts((d) => ({ ...d, [r.name]: e.target.value }))}
                      className="w-16 rounded border border-border bg-background px-2 py-1 text-right text-sm outline-none focus:border-gold"
                    />
                  </td>
                  <td className="py-2.5 pl-2 pr-3 text-right">
                    <button
                      type="button"
                      onClick={() => save(r.name)}
                      disabled={!editing || savingKey === r.name}
                      className="inline-flex items-center gap-1.5 rounded-full bg-gold px-3 py-1.5 text-[11px] uppercase tracking-widest text-gold-foreground disabled:opacity-30">
                      <Save className="h-3 w-3" />
                      {savingKey === r.name ? "…" : "Speichern"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        „Max" begrenzt die Anzahl Reservierungen pro Anlass. 0 oder leer bedeutet kein Limit.
      </p>
    </div>
  );
}
