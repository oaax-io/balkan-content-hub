import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  listReservations,
  updateReservationStatus,
  listOccasionCapacities,

  chargeNoShowFee,
  cancelReservation,
  deleteReservation,
} from "@/lib/reservations.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, X, Phone, Mail, Users, Calendar, CalendarDays, Sparkles, CreditCard, ShieldCheck, AlertTriangle, CircleDollarSign, Pencil, Ban, Clock, TrendingUp, Trash2 } from "lucide-react";
import { ReservationFormEditorDialog } from "./ReservationFormEditor";
import { ConfirmDialog, PromptDialog } from "./InAppDialogs";
import { barColor } from "./OccasionLoad";


const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700 border-yellow-300",
  confirmed: "bg-green-100 text-green-700 border-green-300",
  declined: "bg-red-100 text-red-700 border-red-300",
  cancelled: "bg-gray-100 text-gray-600 border-gray-300",
};
const STATUS_LABEL: Record<string, string> = {
  pending: "Neu", confirmed: "Bestätigt", declined: "Abgelehnt", cancelled: "Storniert",
};

const OCCASION_LABEL_FALLBACK = "Kein Anlass angegeben";

export function ReservationsTab() {
  const listFn = useServerFn(listReservations);
  const updFn = useServerFn(updateReservationStatus);
  const capListFn = useServerFn(listOccasionCapacities);
  const noShowFn = useServerFn(chargeNoShowFee);
  const cancelFn = useServerFn(cancelReservation);
  const deleteFn = useServerFn(deleteReservation);
  const qc = useQueryClient();


  const { data, isLoading } = useQuery({ queryKey: ["reservations"], queryFn: () => listFn() });
  const { data: capacities } = useQuery({ queryKey: ["occasion-capacities"], queryFn: () => capListFn() });
  const { data: occasionsList } = useQuery({
    queryKey: ["occasions-from-content"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_content")
        .select("value")
        .eq("key", "reservation_occasions")
        .maybeSingle();
      if (error) return [] as string[];
      return ((data?.value as string | undefined) ?? "")
        .split("\n").map((s) => s.trim()).filter(Boolean);
    },
  });

  const [filter, setFilter] = useState<string>("all");
  const [occasionFilter, setOccasionFilter] = useState<string>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  // In-App-Dialoge (ersetzen window.confirm / window.prompt)
  const [noShowTarget, setNoShowTarget] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<
    { id: string; isPaid: boolean; daysUntil: number } | null
  >(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  async function setStatus(id: string, status: "confirmed" | "declined" | "pending" | "cancelled") {
    setBusy(id);
    try {
      await updFn({ data: { id, status } });
      toast.success(status === "confirmed" ? "Bestätigt – E-Mail an Gast gesendet" : `Status: ${STATUS_LABEL[status]}`);
      qc.invalidateQueries({ queryKey: ["reservations"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Fehler"); }
    finally { setBusy(null); }
  }

  async function doChargeNoShow(id: string) {
    setBusy(id);
    try {
      const res = await noShowFn({ data: { id, environment: "sandbox" } });
      if (res.ok) {
        toast.success("CHF 50 belastet.");
        qc.invalidateQueries({ queryKey: ["reservations"] });
      } else {
        toast.error(res.error);
      }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Fehler"); }
    finally { setBusy(null); }
  }

  async function doCancel(id: string, reason: string) {
    setBusy(id);
    try {
      const res = await cancelFn({ data: { id, reason: reason || undefined, environment: "sandbox" } });
      if (res.ok) {
        toast.success(res.fee_charged ? "Storniert · CHF 50 belastet" : "Storniert");
        qc.invalidateQueries({ queryKey: ["reservations"] });
      } else {
        toast.error(res.error);
      }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Fehler"); }
    finally { setBusy(null); }
  }

  async function doDelete(id: string) {
    setBusy(id);
    try {
      await deleteFn({ data: { id } });
      toast.success("Reservation gelöscht");
      qc.invalidateQueries({ queryKey: ["reservations"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Fehler"); }
    finally { setBusy(null); }
  }

  if (isLoading) return <p className="text-muted-foreground">Lade …</p>;

  const all = data ?? [];
  // Active reservations only count towards totals (not declined/cancelled)
  const active = all.filter((r) => r.status !== "declined" && r.status !== "cancelled");

  // Build occasions: from configured list + actually used
  const occKeySet = new Set<string>();
  (occasionsList ?? []).forEach((o) => occKeySet.add(o));
  active.forEach((r) => occKeySet.add((r.occasion || "").trim() || OCCASION_LABEL_FALLBACK));
  (capacities ?? []).forEach((c) => occKeySet.add(c.occasion));
  const occKeys = Array.from(occKeySet);

  const capMap = new Map<string, number>();
  (capacities ?? []).forEach((c) => capMap.set(c.occasion, c.max_reservations));

  const perOccasion = occKeys.map((name) => {
    const matches = active.filter((r) => ((r.occasion || "").trim() || OCCASION_LABEL_FALLBACK) === name);
    const reservations = matches.length;
    const persons = matches.reduce((s, r) => s + (r.party_size || 0), 0);
    const max = capMap.get(name) ?? 0;
    const remaining = max > 0 ? Math.max(0, max - reservations) : 0;
    const pct = max > 0 ? Math.min(100, Math.round((reservations / max) * 100)) : 0;
    const isConfigured = !!(occasionsList ?? []).includes(name);
    return { name, reservations, persons, max, remaining, pct, isConfigured };
  }).sort((a, b) => b.reservations - a.reservations || a.name.localeCompare(b.name));

  const totals = {
    reservations: active.length,
    persons: active.reduce((s, r) => s + (r.party_size || 0), 0),
    pending: all.filter((r) => r.status === "pending").length,
    confirmed: all.filter((r) => r.status === "confirmed").length,
  };

  // Storno-Statistik (nur tatsächlich belastete Gebühren zählen)
  const chargedFees = all.filter((r) => r.cancellation_fee_charged_at);
  const feeRevenue = chargedFees.reduce(
    (s, r) => s + ((r.cancellation_fee_amount ?? 5000) / 100), 0);
  const cancelledCount = all.filter((r) => r.status === "cancelled").length;
  const cancelledFree = cancelledCount - chargedFees.length;

  // Sofortzahlungen (Tickets)
  const paidTickets = all.filter((r) => r.ticket_payment_status === "paid");
  const ticketRevenue = paidTickets.reduce((s, r) => s + ((r.ticket_total_rappen ?? 0) / 100), 0);
  const ticketPersons = paidTickets.reduce((s, r) => s + (r.party_size || 0), 0);
  const pendingTickets = all.filter(
    (r) => (r.ticket_total_rappen ?? 0) > 0 && r.ticket_payment_status !== "paid" && r.status !== "cancelled",
  );
  const pendingTicketAmount = pendingTickets.reduce((s, r) => s + ((r.ticket_total_rappen ?? 0) / 100), 0);
  const totalRevenue = ticketRevenue + feeRevenue;

  const avgParty = totals.reservations > 0 ? (totals.persons / totals.reservations).toFixed(1) : "0";
  const withLimit = perOccasion.filter((r) => r.max > 0);
  const totalMax = withLimit.reduce((s, r) => s + r.max, 0);
  const resWithLimit = withLimit.reduce((s, r) => s + r.reservations, 0);
  const overallPct = totalMax > 0 ? Math.min(100, Math.round((resWithLimit / totalMax) * 100)) : 0;
  const maxPersons = perOccasion.reduce((m, r) => Math.max(m, r.persons), 0);


  const filtered = all
    .filter((r) => filter === "all" || r.status === filter)
    .filter((r) => occasionFilter === "all"
      || ((r.occasion || "").trim() || OCCASION_LABEL_FALLBACK) === occasionFilter);

  return (
    <div className="space-y-8">
      <ReservationFormEditorDialog open={editorOpen} onClose={() => setEditorOpen(false)} />

      <ConfirmDialog
        open={!!noShowTarget}
        onOpenChange={(v) => !v && setNoShowTarget(null)}
        title="CHF 50 No-Show Gebühr belasten?"
        description="Diese Aktion kann nicht rückgängig gemacht werden."
        confirmLabel="Belasten"
        destructive
        onConfirm={() => { if (noShowTarget) doChargeNoShow(noShowTarget); setNoShowTarget(null); }}
      />

      <PromptDialog
        open={!!cancelTarget}
        onOpenChange={(v) => !v && setCancelTarget(null)}
        title="Reservation stornieren?"
        description={
          cancelTarget?.isPaid && cancelTarget.daysUntil < 7
            ? `⚠ Achtung: Anlass in ${cancelTarget.daysUntil} Tag(en) — CHF 50 werden dem Gast belastet.`
            : "Storno-Grund (optional):"
        }
        placeholder="Storno-Grund (optional)"
        multiline
        confirmLabel="Stornieren"
        onSubmit={(reason) => { if (cancelTarget) doCancel(cancelTarget.id, reason); }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Reservation endgültig löschen?"
        description={`Die Reservation von „${deleteTarget?.name ?? ""}" wird unwiderruflich aus der Datenbank entfernt.`}
        confirmLabel="Löschen"
        destructive
        onConfirm={() => { if (deleteTarget) doDelete(deleteTarget.id); setDeleteTarget(null); }}
      />

      {/* ───────────── Overview ───────────── */}
      <section className="space-y-4">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl">Reservierungen</h2>
            <p className="text-sm text-muted-foreground mt-1">Übersicht über alle aktiven Reservierungen und Anlässe.</p>
          </div>
          <button
            onClick={() => setEditorOpen(true)}
            className="shrink-0 inline-flex items-center gap-2 rounded-full bg-orange-500 hover:bg-orange-600 px-4 py-2 text-xs uppercase tracking-widest text-white transition-colors shadow-sm"
          >
            <Pencil className="w-3.5 h-3.5" />
            Bearbeiten
          </button>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={CalendarDays} label="Aktive Reservierungen" value={totals.reservations} hint="Bestätigt + offen" />
          <Stat icon={Users} label="Personen gesamt" value={totals.persons} hint={`Ø ${avgParty} pro Reservierung`} />
          <Stat icon={Sparkles} label="Offene Anfragen" value={totals.pending} hint="Noch zu bestätigen" accent={totals.pending > 0} />
          <Stat icon={Check} label="Bestätigt" value={totals.confirmed} hint="Insgesamt" />
        </div>

        {/* Auslastung */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-sm border border-border bg-card p-5 lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">Gesamt-Auslastung</span>
              <TrendingUp className={`h-4 w-4 ${overallPct >= 80 ? "text-gold" : "text-muted-foreground"}`} />
            </div>
            {totalMax > 0 ? (
              <>
                <div className="flex items-end gap-3">
                  <div className={`font-display text-3xl ${overallPct >= 80 ? "text-gold" : ""}`}>{overallPct}%</div>
                  <div className="pb-1 text-xs text-muted-foreground">
                    {resWithLimit} von {totalMax} Plätzen belegt · {Math.max(0, totalMax - resWithLimit)} frei
                  </div>
                </div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full ${barColor(overallPct)} transition-all`} style={{ width: `${overallPct}%` }} />
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Noch keine Limiten gesetzt — im Fenster «Formular bearbeiten» unter «Pro Anlass / Auslastung» festlegen.
              </p>
            )}

            <div className="mt-5 space-y-3">
              {perOccasion.slice(0, 5).map((r) => (
                <button key={r.name} type="button" onClick={() => setOccasionFilter(r.name)}
                  className="block w-full text-left group">
                  <div className="flex items-baseline justify-between gap-3 text-xs">
                    <span className="truncate font-medium group-hover:text-gold">{r.name}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {r.reservations} Res. · {r.persons} Pers.{r.max > 0 ? ` · ${r.pct}%` : ""}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className={`h-full ${r.max > 0 ? barColor(r.pct) : "bg-muted-foreground/40"} transition-all`}
                      style={{ width: `${r.max > 0 ? r.pct : (maxPersons > 0 ? Math.round((r.persons / maxPersons) * 100) : 0)}%` }} />
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            <Stat icon={CircleDollarSign} label="Ticket-Einnahmen" value={ticketRevenue} hint={`${paidTickets.length} bezahlte Reservierung(en) · ${ticketPersons} Pers.`} accent={ticketRevenue > 0} currency />
            <Stat icon={TrendingUp} label="Storno-Einnahmen" value={feeRevenue} hint={`${chargedFees.length} belastete Gebühr(en)`} accent={feeRevenue > 0} currency />
            <Stat icon={Clock} label="Offene Zahlungen" value={pendingTicketAmount} hint={`${pendingTickets.length} noch nicht bezahlt`} accent={pendingTickets.length > 0} currency />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={CreditCard} label="Einnahmen gesamt" value={totalRevenue} hint="Tickets + Stornogebühren" accent={totalRevenue > 0} currency />
          <Stat icon={ShieldCheck} label="Ø pro Ticket-Reservierung" value={paidTickets.length > 0 ? ticketRevenue / paidTickets.length : 0} hint="Sofortzahlungen" currency />
          <Stat icon={Ban} label="Storno kostenpflichtig" value={chargedFees.length} hint="Kurzfristig < 7 Tage" />
          <Stat icon={X} label="Storno kostenlos" value={Math.max(0, cancelledFree)} hint="Rechtzeitig / ohne Gebühr" />
        </div>
      </section>



      {/* ───────────── Filters ───────────── */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="font-display text-xl">Alle Reservierungen</h3>
          <div className="flex flex-wrap gap-1 text-xs">
            {["all", "pending", "confirmed", "declined"].map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full border ${filter === f ? "bg-gold text-gold-foreground border-gold" : "border-border text-muted-foreground hover:text-foreground"}`}>
                {f === "all" ? "Alle Status" : STATUS_LABEL[f]}
              </button>
            ))}
          </div>
        </div>

        {occasionFilter !== "all" && (
          <div className="mb-4 flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Anlass:</span>
            <span className="inline-flex items-center gap-2 rounded-full bg-gold/10 border border-gold/30 px-3 py-1">
              {occasionFilter}
              <button onClick={() => setOccasionFilter("all")} className="hover:text-gold">
                <X className="w-3 h-3" />
              </button>
            </span>
          </div>
        )}

        {filtered.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">Keine Reservierungen.</p>
        ) : (
          <ul className="space-y-3">
            {filtered.map((r) => {
              const daysUntil = daysUntilEvent(r.reservation_date, r.reservation_time);
              const isPast = daysUntil < 0;
              const isUpcoming = r.status !== "cancelled" && r.status !== "declined" && !isPast;
              const daysTone = isPast
                ? "bg-gray-100 text-gray-500 border-gray-200"
                : daysUntil === 0
                  ? "bg-red-50 text-red-700 border-red-200"
                  : daysUntil < 7
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200";
              const accent = r.status === "pending"
                ? "border-l-amber-400"
                : r.status === "confirmed"
                  ? "border-l-emerald-400"
                  : r.status === "declined"
                    ? "border-l-red-400"
                    : "border-l-gray-300";
              const createdLabel = r.created_at
                ? new Date(r.created_at).toLocaleDateString("de-CH", { day: "2-digit", month: "short", year: "numeric" })
                : "—";
              return (
              <li key={r.id} className={`bg-card border border-border border-l-4 ${accent} rounded-sm p-5 shadow-sm hover:shadow-md transition-shadow`}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5 mb-3">
                      <h3 className="font-display text-lg">{r.guest_name}</h3>
                      <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border ${STATUS_STYLES[r.status]}`}>
                        {STATUS_LABEL[r.status]}
                      </span>
                      {isUpcoming && (
                        <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border ${daysTone}`}>
                          <Clock className="w-3 h-3" />
                          {daysUntil === 0 ? "Heute" : daysUntil === 1 ? "Morgen" : `noch ${daysUntil} Tage`}
                        </span>
                      )}
                      {r.occasion && (
                        <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border border-gold/40 text-gold bg-gold/5">
                          {r.occasion}
                        </span>
                      )}
                    </div>

                    <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-muted-foreground">
                      <span className="flex items-center gap-2"><Calendar className="w-4 h-4" /> {fmt(r.reservation_date)} · {r.reservation_time}</span>
                      <span className="flex items-center gap-2"><Users className="w-4 h-4" /> {r.party_size} Personen</span>
                      <a href={`mailto:${r.guest_email}`} className="flex items-center gap-2 hover:text-gold"><Mail className="w-4 h-4" /> {r.guest_email}</a>
                      {r.guest_phone && <a href={`tel:${r.guest_phone}`} className="flex items-center gap-2 hover:text-gold"><Phone className="w-4 h-4" /> {r.guest_phone}</a>}
                      <span className="flex items-center gap-2"><CalendarDays className="w-4 h-4" /> Erstellt am {createdLabel}</span>
                    </div>
                    {r.event_date_label && (
                      <p className="mt-2 text-xs text-muted-foreground">Anlass-Datum: <span className="text-foreground">{r.event_date_label}</span></p>
                    )}
                    {r.notes && <p className="mt-3 text-sm bg-background border border-border rounded-sm p-3 text-muted-foreground">{r.notes}</p>}

                    {/* Stripe / Payment Info */}
                    {(r.is_paid_occasion || r.stripe_payment_method_id) && (
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        {r.is_paid_occasion && (
                          <PayBadge icon={CircleDollarSign} tone="gold">Kostenpflichtig</PayBadge>
                        )}
                        {r.stripe_payment_method_id ? (
                          <PayBadge icon={CreditCard} tone="green">Zahlungsmethode hinterlegt</PayBadge>
                        ) : r.is_paid_occasion ? (
                          <PayBadge icon={AlertTriangle} tone="red">Keine Zahlungsmethode</PayBadge>
                        ) : null}
                        {r.cancellation_terms_accepted && (
                          <PayBadge icon={ShieldCheck} tone="green">Storno-Bedingungen akzeptiert</PayBadge>
                        )}
                        {r.cancellation_fee_charged_at ? (
                          <PayBadge icon={Check} tone="green">
                            CHF 50 belastet · {new Date(r.cancellation_fee_charged_at).toLocaleDateString("de-CH")}
                          </PayBadge>
                        ) : r.is_paid_occasion ? (
                          <PayBadge icon={AlertTriangle} tone="gray">CHF 50 offen</PayBadge>
                        ) : null}
                        {r.cancellation_fee_payment_intent_id && (
                          <span className="text-[10px] font-mono text-muted-foreground px-2 py-0.5 border border-border rounded">
                            {r.cancellation_fee_payment_intent_id}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {r.status === "pending" && (
                      <div className="flex gap-2">
                        <button onClick={() => setStatus(r.id, "confirmed")} disabled={busy === r.id}
                          className="rounded-full bg-green-600/90 hover:bg-green-600 px-4 py-2 text-xs uppercase tracking-widest text-white disabled:opacity-50 flex items-center gap-1.5">
                          <Check className="w-4 h-4" /> Bestätigen
                        </button>
                        <button onClick={() => setStatus(r.id, "declined")} disabled={busy === r.id}
                          className="rounded-full bg-red-600/90 hover:bg-red-600 px-4 py-2 text-xs uppercase tracking-widest text-white disabled:opacity-50 flex items-center gap-1.5">
                          <X className="w-4 h-4" /> Ablehnen
                        </button>
                      </div>
                    )}
                    {r.status === "confirmed"
                      && r.is_paid_occasion
                      && r.stripe_customer_id
                      && r.stripe_payment_method_id
                      && !r.cancellation_fee_charged_at && (
                      <button onClick={() => setNoShowTarget(r.id)} disabled={busy === r.id}
                        className="rounded-full border border-red-300 bg-red-50 hover:bg-red-100 text-red-700 px-4 py-2 text-xs uppercase tracking-widest disabled:opacity-50 flex items-center gap-1.5">
                        <CircleDollarSign className="w-4 h-4" /> CHF 50 No-Show belasten
                      </button>
                    )}
                    {r.status !== "cancelled" && r.status !== "declined" && (
                      <button onClick={() => setCancelTarget({ id: r.id, isPaid: !!r.is_paid_occasion, daysUntil })} disabled={busy === r.id}
                        className="rounded-full border border-border bg-background hover:bg-accent text-foreground px-4 py-2 text-xs uppercase tracking-widest disabled:opacity-50 flex items-center gap-1.5">
                        <Ban className="w-4 h-4" /> Stornieren
                      </button>
                    )}
                    <button onClick={() => setDeleteTarget({ id: r.id, name: r.guest_name })} disabled={busy === r.id}
                      className="rounded-full border border-destructive/40 text-destructive hover:bg-destructive/10 px-4 py-2 text-xs uppercase tracking-widest disabled:opacity-50 flex items-center gap-1.5">
                      <Trash2 className="w-4 h-4" /> Löschen
                    </button>
                  </div>
                </div>
              </li>
              );
            })}

          </ul>
        )}
      </section>
    </div>
  );
}

function PayBadge({ icon: Icon, tone, children }: {
  icon: typeof Users; tone: "gold" | "green" | "red" | "gray"; children: React.ReactNode;
}) {
  const styles: Record<string, string> = {
    gold: "border-gold/40 text-gold bg-gold/5",
    green: "border-green-300 text-green-700 bg-green-50",
    red: "border-red-300 text-red-700 bg-red-50",
    gray: "border-border text-muted-foreground bg-muted/50",
  };
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border ${styles[tone]}`}>
      <Icon className="w-3 h-3" /> {children}
    </span>
  );
}

function Stat({ icon: Icon, label, value, hint, accent, currency }: {
  icon: typeof Users; label: string; value: number; hint: string; accent?: boolean; currency?: boolean;
}) {
  const formatted = currency
    ? `CHF ${value.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : value.toLocaleString("de-CH");
  return (
    <div className="rounded-sm border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
        <Icon className={`w-4 h-4 ${accent ? "text-gold" : "text-muted-foreground"}`} />
      </div>
      <div className={`text-3xl font-display ${accent ? "text-gold" : ""}`}>{formatted}</div>
      <div className="text-xs text-muted-foreground mt-1">{hint}</div>
    </div>
  );
}



function fmt(d: string) {
  try { return new Date(d + "T00:00:00").toLocaleDateString("de-CH", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }); }
  catch { return d; }
}

function daysUntilEvent(date: string, time: string | null | undefined): number {
  try {
    const event = new Date(`${date}T${(time || "00:00")}:00`);
    const now = new Date();
    // Ganze Kalendertage bis zum Event
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    return Math.round((startOfDay(event) - startOfDay(now)) / (1000 * 60 * 60 * 24));
  } catch { return 0; }
}

