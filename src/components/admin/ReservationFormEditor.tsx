import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { listSiteContent, updateSiteContent, updateSiteContentBulk } from "@/lib/admin.functions";
import { toast } from "sonner";
import { CalendarDays, Plus, Trash2, CreditCard, Calendar as CalendarIcon, X, Settings2 } from "lucide-react";
import { parseOccasionNumberMap, serializeOccasionNumberMap, parseOccasionTextMap, serializeOccasionTextMap } from "@/lib/occasions";

type Row = { key: string; value: string; label: string; kind: string; sort_order: number; preview_url: string };
type Occasion = { label: string; paid: boolean; hasDates: boolean; price: number; minGuests: number; cancelFee: number; noShowFee: number; policy: string };


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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-0 sm:p-4">
      <div className="flex h-full w-full flex-col overflow-hidden bg-card shadow-2xl sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:max-w-2xl sm:rounded-lg sm:border sm:border-border">
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-card px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
            <h2 className="truncate font-display text-lg">Reservierungsformular bearbeiten</h2>
          </div>
          <button ref={closeRef} onClick={onClose} className="shrink-0 rounded-full p-2 hover:bg-accent" aria-label="Schliessen">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5">
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
    <div className="space-y-4">
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
    const prices = parseOccasionNumberMap(rowMap.get("reservation_occasion_prices")?.value ?? "");
    const mins = parseOccasionNumberMap(rowMap.get("reservation_occasion_min_guests")?.value ?? "");
    const cancelFees = parseOccasionNumberMap(rowMap.get("reservation_occasion_cancel_fees")?.value ?? "");
    const noShowFees = parseOccasionNumberMap(rowMap.get("reservation_occasion_noshow_fees")?.value ?? "");
    const policies = parseOccasionTextMap(rowMap.get("reservation_occasion_disclaimers")?.value ?? "");
    return labels.map((label) => ({
      label,
      paid: paid.has(label.toLowerCase()),
      hasDates: dates.has(label.toLowerCase()),
      price: prices[label.toLowerCase()] ?? 0,
      minGuests: mins[label.toLowerCase()] ?? 0,
      cancelFee: cancelFees[label.toLowerCase()] ?? 0,
      noShowFee: noShowFees[label.toLowerCase()] ?? 0,
      policy: policies[label.toLowerCase()] ?? "",
    }));
  }, [rowMap]);

  const [items, setItems] = useState<Occasion[]>(initial);
  const [saving, setSaving] = useState(false);
  const [settingsIndex, setSettingsIndex] = useState<number | null>(null);
  const [payMode, setPayMode] = useState<"fee" | "ticket">("fee");
  const openSettings = (i: number, price: number) => { setPayMode(price > 0 ? "ticket" : "fee"); setSettingsIndex(i); };
  useEffect(() => { setItems(initial); }, [initial]);

  const dirty = JSON.stringify(items) !== JSON.stringify(initial);

  const update = (i: number, patch: Partial<Occasion>) =>
    setItems((p) => p.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const remove = (i: number) => { setItems((p) => p.filter((_, idx) => idx !== i)); setSettingsIndex(null); };
  const add = () => setItems((p) => [...p, { label: "", paid: false, hasDates: false, price: 0, minGuests: 0, cancelFee: 0, noShowFee: 0, policy: "" }]);

  const togglePaid = (i: number, checked: boolean) => {
    update(i, { paid: checked });
    if (checked) openSettings(i, items[i]?.price ?? 0);
  };

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
      { key: "reservation_occasion_prices", value: serializeOccasionNumberMap(unique.map((i) => ({ label: i.label, value: i.price }))) },
      { key: "reservation_occasion_min_guests", value: serializeOccasionNumberMap(unique.map((i) => ({ label: i.label, value: i.minGuests }))) },
      { key: "reservation_occasion_cancel_fees", value: serializeOccasionNumberMap(unique.map((i) => ({ label: i.label, value: i.cancelFee }))) },
      { key: "reservation_occasion_noshow_fees", value: serializeOccasionNumberMap(unique.map((i) => ({ label: i.label, value: i.noShowFee }))) },
      { key: "reservation_occasion_disclaimers", value: serializeOccasionTextMap(unique.map((i) => ({ label: i.label, value: i.policy }))) },
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
      <div className="border-b border-border bg-accent/20 px-3 py-3 sm:px-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-primary" />
          <span className="font-medium text-foreground">Anlass-Optionen (Dropdown im Formular)</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Anlass, Zahlung, Termine und Mindestanzahl individuell festlegen.
        </p>
      </div>

      <div className="space-y-2 p-3 sm:p-4">
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground italic">Noch keine Anlässe. Füge einen hinzu ↓</p>
        )}
        {items.map((it, i) => (
          <div key={i} className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-2 rounded-md border border-border bg-card p-2.5">
            <div className="row-span-2 flex flex-col justify-center text-xs text-muted-foreground">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="disabled:opacity-30 hover:text-foreground">▲</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} className="disabled:opacity-30 hover:text-foreground">▼</button>
            </div>
            <input
              value={it.label}
              onChange={(e) => update(i, { label: e.target.value })}
              placeholder="z.B. Ticket ab 21:30 Uhr (CHF 15.-)"
              className="min-w-0 bg-card border border-border rounded-sm px-3 py-2 focus:border-primary outline-none text-sm"
            />
            <button type="button" onClick={() => remove(i)} className="row-span-2 self-center p-2 text-muted-foreground hover:text-destructive transition-colors" title="Entfernen" aria-label={`${it.label || "Anlass"} entfernen`}>
              <Trash2 className="w-4 h-4" />
            </button>
            <div className="col-start-2 flex min-w-0 flex-wrap gap-1.5">
            <label className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border cursor-pointer select-none ${it.paid ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
              <input type="checkbox" className="sr-only" checked={it.paid} onChange={(e) => togglePaid(i, e.target.checked)} />
              <CreditCard className="w-3.5 h-3.5" />
              Kostenpflichtig
            </label>
            {it.paid && (
              <button type="button" onClick={() => openSettings(i, it.price)}
                className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                title="Preis & Gäste-Einstellungen">
                <Settings2 className="w-3.5 h-3.5" />
                <span className="truncate">{it.price > 0 ? `CHF ${it.price.toFixed(2)} / Pers.` : `Storno ${it.cancelFee || 50} · No-Show ${it.noShowFee || it.cancelFee || 50}`}</span>
              </button>
            )}
            <label className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border cursor-pointer select-none ${it.hasDates ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
              <input type="checkbox" className="sr-only" checked={it.hasDates} onChange={(e) => update(i, { hasDates: e.target.checked })} />
              <CalendarIcon className="w-3.5 h-3.5" />
              Event-Daten
            </label>
            </div>
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

      {settingsIndex !== null && items[settingsIndex] && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/70 p-0 sm:p-4">
          <div className="flex h-full w-full flex-col overflow-hidden bg-background shadow-2xl sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:max-w-lg sm:rounded-lg sm:border sm:border-border">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-primary" />
                <div className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">Zahlungs-Einstellungen</span>
                  {items[settingsIndex].label && <span className="block max-w-[16rem] truncate text-xs text-muted-foreground">{items[settingsIndex].label}</span>}
                </div>
              </div>
              <button type="button" onClick={() => setSettingsIndex(null)} className="rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" aria-label="Schliessen">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 sm:px-5">
              <div>
                <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">Zahlungsart</label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button type="button"
                    onClick={() => { setPayMode("fee"); update(settingsIndex, { price: 0 }); }}
                     className={`text-left p-2.5 rounded-md border transition-colors ${payMode === "fee" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}>
                    <span className="block text-sm text-foreground">Nur Stornogebühr</span>
                    <span className="block text-xs text-muted-foreground mt-1">
                      Karte als Sicherheit; Belastung nur bei Storno oder No-Show.
                    </span>
                  </button>
                  <button type="button"
                    onClick={() => setPayMode("ticket")}
                     className={`text-left p-2.5 rounded-md border transition-colors ${payMode === "ticket" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}>
                    <span className="block text-sm text-foreground">Sofortzahlung (Ticket)</span>
                    <span className="block text-xs text-muted-foreground mt-1">
                      Der Gast bezahlt den Ticketpreis direkt online bei der Reservation.
                    </span>
                  </button>
                </div>
              </div>
              {payMode === "ticket" && (
                <div>
                  <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1.5">Ticketpreis pro Person (CHF)</label>
                  <input
                    type="number" min={0} step="0.05" inputMode="decimal"
                    value={items[settingsIndex].price || ""}
                    onChange={(e) => update(settingsIndex, { price: Number(e.target.value) || 0 })}
                    placeholder="z.B. 15.00"
                    className="w-full bg-card border border-border rounded-sm px-3 py-2.5 focus:border-primary outline-none text-sm text-foreground"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    {items[settingsIndex].price > 0
                      ? <>Total: <strong className="text-foreground">CHF {items[settingsIndex].price.toFixed(2)} × Personen</strong>, sofort online bezahlt.</>
                      : <>Bitte Preis eintragen – ohne Preis gilt automatisch die Stornogebühr-Variante.</>}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1.5">Mindestanzahl Gäste</label>
                <input
                  type="number" min={1} max={99} step={1}
                  value={items[settingsIndex].minGuests || ""}
                  onChange={(e) => update(settingsIndex, { minGuests: Number(e.target.value) || 0 })}
                  placeholder={items[settingsIndex].price > 0 ? "1" : "2"}
                  className="w-full bg-card border border-border rounded-sm px-3 py-2.5 focus:border-primary outline-none text-sm text-foreground"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Leer lassen für Standard: {items[settingsIndex].price > 0 ? "1 Person (Tickets einzeln buchbar)" : "2 Personen"}.
                </p>
              </div>
              {payMode === "fee" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1.5">Storno-Betrag / Pers. (CHF)</label>
                    <input type="number" min={0} step="0.05" inputMode="decimal"
                      value={items[settingsIndex].cancelFee || ""}
                      onChange={(e) => update(settingsIndex, { cancelFee: Number(e.target.value) || 0 })}
                      placeholder="50.00"
                      className="w-full bg-card border border-border rounded-sm px-3 py-2.5 focus:border-primary outline-none text-sm text-foreground" />
                    <p className="text-xs text-muted-foreground mt-1.5">Bei Storno innert 7 Tagen vor dem Anlass.</p>
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1.5">No-Show-Betrag / Pers. (CHF)</label>
                    <input type="number" min={0} step="0.05" inputMode="decimal"
                      value={items[settingsIndex].noShowFee || ""}
                      onChange={(e) => update(settingsIndex, { noShowFee: Number(e.target.value) || 0 })}
                      placeholder={(items[settingsIndex].cancelFee || 50).toFixed(2)}
                      className="w-full bg-card border border-border rounded-sm px-3 py-2.5 focus:border-primary outline-none text-sm text-foreground" />
                    <p className="text-xs text-muted-foreground mt-1.5">Bei Nichterscheinen. Leer = gleich wie Storno-Betrag.</p>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1.5">Richtlinien-Text für diesen Anlass</label>
                <textarea rows={3}
                  value={items[settingsIndex].policy}
                  onChange={(e) => update(settingsIndex, { policy: e.target.value })}
                  placeholder="Leer lassen für den allgemeinen Standardtext."
                  className="w-full bg-card border border-border rounded-sm px-3 py-2.5 focus:border-primary outline-none text-sm text-foreground" />
                <p className="text-xs text-muted-foreground mt-1.5">
                  Erscheint im Reservationsformular als Checkbox-Text, wenn dieser Anlass gewählt wird.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 justify-end border-t border-border bg-background px-4 py-3 sm:px-5">
              <button type="button" onClick={() => setSettingsIndex(null)}
                className="rounded-full bg-primary px-5 py-2 text-xs uppercase tracking-widest text-primary-foreground">
                Übernehmen
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
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

