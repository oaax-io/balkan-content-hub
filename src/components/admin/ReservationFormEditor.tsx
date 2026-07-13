import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, useEffect, useRef } from "react";
import { listSiteContent, updateSiteContent, updateSiteContentBulk } from "@/lib/admin.functions";
import { toast } from "sonner";
import { CalendarDays, Plus, Trash2, CreditCard, Calendar as CalendarIcon, X } from "lucide-react";

type Row = { key: string; value: string; label: string; kind: string; sort_order: number; preview_url: string };
type Occasion = { label: string; paid: boolean; hasDates: boolean };

const parseList = (v: string) => (v || "").split("\n").map((s) => s.trim()).filter(Boolean);

export function ReservationFormEditorDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 overflow-y-auto bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-3xl bg-card border border-border rounded-lg shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card z-10 rounded-t-lg">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            <h2 className="font-display text-xl">Reservierungsformular bearbeiten</h2>
          </div>
          <button ref={closeRef} onClick={onClose} className="p-2 rounded-full hover:bg-accent" aria-label="Schliessen">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-6">
          <ReservationFormEditor />
        </div>
      </div>
    </div>
  );
}

export function ReservationFormEditor() {
  const listFn = useServerFn(listSiteContent);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["site-content-admin"], queryFn: () => listFn() });

  const rowMap = useMemo(() => {
    const m = new Map<string, Row>();
    for (const r of (data ?? []) as Row[]) m.set(r.key, r);
    return m;
  }, [data]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["site-content-admin"] });
    qc.invalidateQueries({ queryKey: ["public-data"] });
    qc.invalidateQueries({ queryKey: ["occasions-from-content"] });
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Lade …</p>;

  return (
    <div className="space-y-5">
      <OccasionsEditor rowMap={rowMap} onSaved={refresh} />
      <PerOccasionDatesEditor rowMap={rowMap} onSaved={refresh} />
      <TextField rowMap={rowMap} keyName="reservation_disclaimer" onSaved={refresh}
        help="Stornierungs-Hinweis für kostenpflichtige Anlässe (z.B. Dinner & Dance). Wird als Checkbox-Text im Reservationsformular angezeigt." />
    </div>
  );
}


function TextField({
  rowMap, keyName, onSaved, help, isList,
}: { rowMap: Map<string, Row>; keyName: string; onSaved: () => void; help?: string; isList?: boolean }) {
  const row = rowMap.get(keyName);
  const updFn = useServerFn(updateSiteContent);
  const [value, setValue] = useState(row?.value ?? "");
  const [saving, setSaving] = useState(false);
  useEffect(() => { setValue(row?.value ?? ""); }, [row?.value]);

  if (!row) return null;
  const items = isList ? parseList(value) : [];

  async function save() {
    setSaving(true);
    try { await updFn({ data: { key: keyName, value } }); toast.success("Gespeichert"); onSaved(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Fehler"); }
    finally { setSaving(false); }
  }

  return (
    <div className="border border-border rounded-md bg-background p-4">
      <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">{row.label || keyName}</label>
      {help && <p className="text-xs text-muted-foreground mb-2">{help}</p>}
      <textarea rows={isList ? 6 : 3} value={value} onChange={(e) => setValue(e.target.value)}
        className="w-full bg-card border border-border rounded-sm px-3 py-2 focus:border-primary outline-none font-mono text-sm" />
      {isList && items.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {items.map((it, i) => (
            <span key={i} className="inline-flex items-center rounded-full bg-accent text-accent-foreground px-3 py-1 text-xs border border-border">{it}</span>
          ))}
        </div>
      )}
      <div className="flex justify-end mt-3">
        <button onClick={save} disabled={saving || value === row.value}
          className="rounded-full bg-primary px-5 py-2 text-xs uppercase tracking-widest text-primary-foreground disabled:opacity-50">
          {saving ? "…" : "Speichern"}
        </button>
      </div>
    </div>
  );
}

function OccasionsEditor({ rowMap, onSaved }: { rowMap: Map<string, Row>; onSaved: () => void }) {
  const bulkFn = useServerFn(updateSiteContentBulk);

  const initial: Occasion[] = useMemo(() => {
    const labels = parseList(rowMap.get("reservation_occasions")?.value ?? "");
    const paid = new Set(parseList(rowMap.get("reservation_paid_occasions")?.value ?? "").map((s) => s.toLowerCase()));
    const dates = new Set(parseList(rowMap.get("reservation_occasions_with_dates")?.value ?? "").map((s) => s.toLowerCase()));
    return labels.map((label) => ({
      label,
      paid: paid.has(label.toLowerCase()),
      hasDates: dates.has(label.toLowerCase()),
    }));
  }, [rowMap]);

  const [items, setItems] = useState<Occasion[]>(initial);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setItems(initial); }, [initial]);

  const dirty = JSON.stringify(items) !== JSON.stringify(initial);

  const update = (i: number, patch: Partial<Occasion>) =>
    setItems((p) => p.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const remove = (i: number) => setItems((p) => p.filter((_, idx) => idx !== i));
  const add = () => setItems((p) => [...p, { label: "", paid: false, hasDates: false }]);
  const move = (i: number, dir: -1 | 1) =>
    setItems((p) => {
      const n = [...p]; const j = i + dir;
      if (j < 0 || j >= n.length) return p;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  async function save() {
    const cleaned = items.map((it) => ({ ...it, label: it.label.trim() })).filter((it) => it.label.length > 0);
    const seen = new Set<string>();
    const unique = cleaned.filter((it) => {
      const k = it.label.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
    const entries = [
      { key: "reservation_occasions", value: unique.map((i) => i.label).join("\n") },
      { key: "reservation_paid_occasions", value: unique.filter((i) => i.paid).map((i) => i.label).join("\n") },
      { key: "reservation_occasions_with_dates", value: unique.filter((i) => i.hasDates).map((i) => i.label).join("\n") },
    ];
    setSaving(true);
    try {
      await bulkFn({ data: { entries } });
      toast.success("Anlass-Optionen gespeichert");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    } finally { setSaving(false); }
  }

  return (
    <div className="border border-border rounded-md bg-background overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-accent/20">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-primary" />
          <span className="font-medium text-foreground">Anlass-Optionen (Dropdown im Formular)</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Pro Anlass legst du fest, ob er <strong>kostenpflichtig</strong> ist (Stripe + CHF 50 Storno) und ob dazu <strong>Event-Daten</strong> zur Auswahl erscheinen.
        </p>
      </div>

      <div className="p-4 space-y-2">
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground italic">Noch keine Anlässe. Füge einen hinzu ↓</p>
        )}
        {items.map((it, i) => (
          <div key={i} className="flex flex-col md:flex-row md:items-center gap-2 p-3 rounded-md border border-border bg-card">
            <div className="flex flex-col text-muted-foreground text-xs">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="disabled:opacity-30 hover:text-foreground">▲</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} className="disabled:opacity-30 hover:text-foreground">▼</button>
            </div>
            <input
              value={it.label}
              onChange={(e) => update(i, { label: e.target.value })}
              placeholder="z.B. Dinner & Dance (99.- pro Person)"
              className="flex-1 bg-card border border-border rounded-sm px-3 py-2 focus:border-primary outline-none text-sm"
            />
            <label className={`inline-flex items-center gap-2 text-xs px-3 py-2 rounded-md border cursor-pointer select-none ${it.paid ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
              <input type="checkbox" className="sr-only" checked={it.paid} onChange={(e) => update(i, { paid: e.target.checked })} />
              <CreditCard className="w-3.5 h-3.5" />
              Kostenpflichtig
            </label>
            <label className={`inline-flex items-center gap-2 text-xs px-3 py-2 rounded-md border cursor-pointer select-none ${it.hasDates ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
              <input type="checkbox" className="sr-only" checked={it.hasDates} onChange={(e) => update(i, { hasDates: e.target.checked })} />
              <CalendarIcon className="w-3.5 h-3.5" />
              Event-Daten
            </label>
            <button type="button" onClick={() => remove(i)} className="p-2 text-muted-foreground hover:text-destructive transition-colors" title="Entfernen">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <button type="button" onClick={add}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs uppercase tracking-widest text-foreground hover:bg-accent">
            <Plus className="w-3.5 h-3.5" /> Anlass hinzufügen
          </button>
          <button onClick={save} disabled={saving || !dirty}
            className="rounded-full bg-primary px-5 py-2 text-xs uppercase tracking-widest text-primary-foreground disabled:opacity-50">
            {saving ? "Speichere …" : "Änderungen speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PerOccasionDatesEditor: Termine pro Anlass verwalten
// ============================================================================
type DateEntry = { date: string; label: string };

function formatGermanDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  try {
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return d.toLocaleDateString("de-CH", {
      weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "UTC",
    });
  } catch { return iso; }
}

function parseDatesByOccasion(raw: string): Map<string, DateEntry[]> {
  const map = new Map<string, DateEntry[]>();
  for (const line of (raw || "").split("\n").map((s) => s.trim()).filter(Boolean)) {
    const sepIdx = line.indexOf("::");
    const occKey = sepIdx >= 0 ? line.slice(0, sepIdx).trim() : "";
    const rest = sepIdx >= 0 ? line.slice(sepIdx + 2).trim() : line.trim();
    const [machine, ...labelParts] = rest.split("|");
    const date = (machine || "").trim();
    if (!date) continue;
    const label = labelParts.length > 0 ? labelParts.join("|").trim() : formatGermanDate(date);
    const arr = map.get(occKey) ?? [];
    arr.push({ date, label });
    map.set(occKey, arr);
  }
  return map;
}

function serializeDatesByOccasion(map: Map<string, DateEntry[]>): string {
  const lines: string[] = [];
  for (const [occ, entries] of map.entries()) {
    for (const e of entries) {
      if (!e.date) continue;
      const label = e.label && e.label !== e.date ? ` | ${e.label}` : "";
      lines.push(occ ? `${occ} :: ${e.date}${label}` : `${e.date}${label}`);
    }
  }
  return lines.join("\n");
}

function PerOccasionDatesEditor({ rowMap, onSaved }: { rowMap: Map<string, Row>; onSaved: () => void }) {
  const updFn = useServerFn(updateSiteContent);
  const occasions = useMemo(() => parseList(rowMap.get("reservation_occasions")?.value ?? ""), [rowMap]);
  const withDates = useMemo(() => {
    const set = new Set(parseList(rowMap.get("reservation_occasions_with_dates")?.value ?? "").map((s) => s.toLowerCase()));
    return occasions.filter((o) => set.has(o.toLowerCase()));
  }, [rowMap, occasions]);

  const initialMap = useMemo(() => parseDatesByOccasion(rowMap.get("reservation_event_dates")?.value ?? ""), [rowMap]);
  const [datesByOcc, setDatesByOcc] = useState<Map<string, DateEntry[]>>(initialMap);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setDatesByOcc(initialMap); }, [initialMap]);

  const currentSerialized = serializeDatesByOccasion(datesByOcc);
  const initialSerialized = serializeDatesByOccasion(initialMap);
  const dirty = currentSerialized !== initialSerialized;

  const addDate = (occ: string) => {
    setDatesByOcc((prev) => {
      const next = new Map(prev);
      next.set(occ, [...(next.get(occ) ?? []), { date: "", label: "" }]);
      return next;
    });
  };
  const updateEntry = (occ: string, idx: number, patch: Partial<DateEntry>) => {
    setDatesByOcc((prev) => {
      const next = new Map(prev);
      const arr = [...(next.get(occ) ?? [])];
      arr[idx] = { ...arr[idx], ...patch };
      // Wenn Label leer & Datum vorhanden → Auto-Format
      if (patch.date !== undefined && !arr[idx].label) {
        arr[idx].label = formatGermanDate(arr[idx].date);
      }
      next.set(occ, arr);
      return next;
    });
  };
  const removeEntry = (occ: string, idx: number) => {
    setDatesByOcc((prev) => {
      const next = new Map(prev);
      next.set(occ, (next.get(occ) ?? []).filter((_, i) => i !== idx));
      return next;
    });
  };

  async function save() {
    setSaving(true);
    try {
      await updFn({ data: { key: "reservation_event_dates", value: currentSerialized } });
      toast.success("Termine gespeichert");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  if (withDates.length === 0) {
    return (
      <div className="border border-border rounded-md bg-background p-4">
        <div className="flex items-center gap-2 mb-1">
          <CalendarIcon className="w-4 h-4 text-primary" />
          <span className="font-medium text-foreground">Termine pro Anlass</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Aktiviere oben bei mindestens einem Anlass „Event-Daten", um Termine zu hinterlegen.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-md bg-background overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-accent/20">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-primary" />
          <span className="font-medium text-foreground">Termine pro Anlass</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Für jeden Anlass mit aktivierten Event-Daten kannst du eigene Termine hinterlegen. Im Formular erscheinen nur die zum gewählten Anlass passenden Daten.
        </p>
      </div>

      <div className="p-4 space-y-4">
        {withDates.map((occ) => {
          const entries = datesByOcc.get(occ) ?? [];
          return (
            <div key={occ} className="rounded-md border border-border bg-card p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{occ}</span>
                <button type="button" onClick={() => addDate(occ)}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                  <Plus className="w-3.5 h-3.5" /> Termin
                </button>
              </div>
              {entries.length === 0 && (
                <p className="text-xs text-muted-foreground italic">Noch keine Termine.</p>
              )}
              <div className="space-y-2">
                {entries.map((e, i) => (
                  <div key={i} className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="date"
                      value={e.date}
                      onChange={(ev) => updateEntry(occ, i, { date: ev.target.value })}
                      className="bg-card border border-border rounded-sm px-3 py-2 text-sm focus:border-primary outline-none"
                    />
                    <input
                      type="text"
                      value={e.label}
                      placeholder="Anzeige-Label (z.B. Samstag, 20. Juni 2026)"
                      onChange={(ev) => updateEntry(occ, i, { label: ev.target.value })}
                      className="flex-1 bg-card border border-border rounded-sm px-3 py-2 text-sm focus:border-primary outline-none"
                    />
                    <button type="button" onClick={() => removeEntry(occ, i)}
                      className="p-2 text-muted-foreground hover:text-destructive" title="Entfernen">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <div className="flex justify-end pt-2">
          <button onClick={save} disabled={saving || !dirty}
            className="rounded-full bg-primary px-5 py-2 text-xs uppercase tracking-widest text-primary-foreground disabled:opacity-50">
            {saving ? "Speichere …" : "Termine speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}

