// Client-safe Helfer für die Anlass-Konfiguration (Ticketpreis + Mindestgäste).
// Gespeichert in `site_content` als Zeilen im Format "Anlass::Wert".

export type OccasionConfigMap = Record<string, number>;

function normKey(s: string) {
  return s.trim().toLowerCase();
}

export function parseOccasionNumberMap(raw: string | null | undefined): OccasionConfigMap {
  const out: OccasionConfigMap = {};
  for (const line of (raw || "").split("\n")) {
    const idx = line.indexOf("::");
    if (idx < 0) continue;
    const label = normKey(line.slice(0, idx));
    const value = Number(line.slice(idx + 2).trim().replace(",", "."));
    if (!label || !Number.isFinite(value)) continue;
    out[label] = value;
  }
  return out;
}

export function serializeOccasionNumberMap(entries: { label: string; value: number }[]): string {
  return entries
    .filter((e) => e.label.trim() && Number.isFinite(e.value) && e.value > 0)
    .map((e) => `${e.label.trim()}::${e.value}`)
    .join("\n");
}

/** Ticketpreis pro Person in CHF (0 = kein Sofort-Ticket). */
export function getOccasionPrice(occasion: string | null | undefined, prices: OccasionConfigMap): number {
  if (!occasion) return 0;
  const v = prices[normKey(occasion)];
  return typeof v === "number" && v > 0 ? v : 0;
}

/** Mindestanzahl Gäste (Standard 2, bei Ticket-Anlässen Standard 1). */
export function getOccasionMinGuests(
  occasion: string | null | undefined,
  minGuests: OccasionConfigMap,
  hasTicketPrice = false,
): number {
  if (occasion) {
    const v = minGuests[normKey(occasion)];
    if (typeof v === "number" && v >= 1) return Math.floor(v);
  }
  return hasTicketPrice ? 1 : 2;
}

export function formatChf(amount: number): string {
  return amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2);
}

/** Textwerte pro Anlass ("Anlass::Text", Zeilenumbrüche als \n kodiert). */
export function parseOccasionTextMap(raw: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of (raw || "").split("\n")) {
    const idx = line.indexOf("::");
    if (idx < 0) continue;
    const label = normKey(line.slice(0, idx));
    const value = line.slice(idx + 2).trim().replace(/\\n/g, "\n");
    if (!label || !value) continue;
    out[label] = value;
  }
  return out;
}

export function serializeOccasionTextMap(entries: { label: string; value: string }[]): string {
  return entries
    .filter((e) => e.label.trim() && (e.value || "").trim())
    .map((e) => `${e.label.trim()}::${e.value.trim().replace(/\r?\n/g, "\\n")}`)
    .join("\n");
}

export function getOccasionText(occasion: string | null | undefined, map: Record<string, string>): string {
  if (!occasion) return "";
  return map[normKey(occasion)] ?? "";
}

/** Gebühr pro Person in CHF, Fallback 50. */
export function getOccasionFee(
  occasion: string | null | undefined,
  fees: OccasionConfigMap,
  fallback = 50,
): number {
  if (occasion) {
    const v = fees[normKey(occasion)];
    if (typeof v === "number" && v > 0) return v;
  }
  return fallback;
}
