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
