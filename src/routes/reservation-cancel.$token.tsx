import { createFileRoute, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getReservationByToken, cancelReservationByToken } from "@/lib/reservations.functions";

export const Route = createFileRoute("/reservation-cancel/$token")({
  head: () => ({
    meta: [
      { title: "Reservation stornieren — Balkaneros" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: CancelPage,
});

function fmtDate(d: string) {
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("de-CH", {
      weekday: "long", day: "2-digit", month: "long", year: "numeric",
    });
  } catch { return d; }
}

function CancelPage() {
  const { token } = useParams({ from: "/reservation-cancel/$token" });
  const getFn = useServerFn(getReservationByToken);
  const cancelFn = useServerFn(cancelReservationByToken);

  const query = useQuery({
    queryKey: ["reservation-token", token],
    queryFn: () => getFn({ data: { token } }),
    retry: false,
    staleTime: 30_000,
  });

  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; feeCharged?: boolean } | null>(null);

  const mutation = useMutation({
    mutationFn: () => cancelFn({ data: { token, environment: "sandbox" } }),
    onSuccess: (res) => {
      if (res.ok) {
        setResult({
          ok: true,
          feeCharged: res.fee_charged,
          message: res.fee_charged
            ? `Ihre Reservation wurde storniert. Eine Storno-Gebühr wurde belastet.`
            : `Ihre Reservation wurde kostenlos storniert. Vielen Dank für die frühzeitige Nachricht.`,
        });
      } else {
        setResult({ ok: false, message: res.error });
      }
    },
    onError: (e: Error) => setResult({ ok: false, message: e.message }),
  });

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-black/40 p-8 shadow-xl backdrop-blur">
        <h1 className="text-2xl font-display text-gold">Reservation stornieren</h1>

        {query.isLoading && <p className="mt-6 text-sm text-muted-foreground">Wird geladen…</p>}

        {query.isError && (
          <p className="mt-6 text-sm text-red-400">
            Der Storno-Link konnte nicht geladen werden. Bitte versuchen Sie es später erneut.
          </p>
        )}

        {query.data && !query.data.ok && (
          <p className="mt-6 text-sm text-red-400">{query.data.error}</p>
        )}

        {query.data?.ok && (() => {
          const info = query.data.info;
          if (result?.ok) {
            return (
              <div className="mt-6 space-y-3 text-sm">
                <p className="text-green-400 font-medium">{result.message}</p>
                <p className="text-muted-foreground">
                  Eine Bestätigung wurde an Ihre E-Mail-Adresse gesendet.
                </p>
              </div>
            );
          }

          if (info.already_cancelled) {
            return (
              <p className="mt-6 text-sm text-muted-foreground">
                Diese Reservation wurde bereits storniert
                {info.fee_already_charged ? " (eine Gebühr wurde belastet)" : ""}.
              </p>
            );
          }

          return (
            <>
              <div className="mt-6 space-y-2 text-sm">
                <p><span className="text-muted-foreground">Gast:</span> {info.guest_name}</p>
                <p><span className="text-muted-foreground">Datum:</span> {fmtDate(info.reservation_date)}</p>
                <p><span className="text-muted-foreground">Uhrzeit:</span> {info.reservation_time}</p>
                <p><span className="text-muted-foreground">Personen:</span> {info.party_size}</p>
                {info.occasion && <p><span className="text-muted-foreground">Anlass:</span> {info.occasion}</p>}
                {info.event_date_label && (
                  <p><span className="text-muted-foreground">Event:</span> {info.event_date_label}</p>
                )}
              </div>

              <div className={`mt-6 rounded-lg border p-4 text-sm ${
                info.fee_applies
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                  : "border-green-500/30 bg-green-500/10 text-green-200"
              }`}>
                {info.fee_applies ? (
                  <>
                    <p className="font-medium">Kostenpflichtige Stornierung</p>
                    <p className="mt-1">
                      Der Anlass ist in {Math.max(0, info.days_until)} Tag(en).
                      Bei Stornierung wird eine Gebühr von{" "}
                      <strong>CHF {(info.fee_amount / 100).toFixed(2)}</strong> von
                      Ihrer hinterlegten Zahlungsmethode belastet.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-medium">Kostenlose Stornierung</p>
                    <p className="mt-1">
                      {info.is_paid_occasion
                        ? `Da noch mehr als 7 Tage bis zum Anlass sind, ist die Stornierung kostenfrei.`
                        : `Für diesen Anlass fallen keine Storno-Gebühren an.`}
                    </p>
                  </>
                )}
              </div>

              {result && !result.ok && (
                <p className="mt-4 text-sm text-red-400">{result.message}</p>
              )}

              <div className="mt-6 flex flex-col gap-3">
                {!confirming ? (
                  <button
                    type="button"
                    onClick={() => setConfirming(true)}
                    className="rounded-full bg-gold px-5 py-2.5 text-sm uppercase tracking-widest text-gold-foreground hover:opacity-90"
                  >
                    Reservation stornieren
                  </button>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Sind Sie sicher? Diese Aktion kann nicht rückgängig gemacht werden
                      {info.fee_applies ? ` und CHF ${(info.fee_amount / 100).toFixed(2)} werden belastet` : ""}.
                    </p>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        disabled={mutation.isPending}
                        onClick={() => mutation.mutate()}
                        className="rounded-full bg-red-600 px-5 py-2.5 text-sm uppercase tracking-widest text-white hover:bg-red-700 disabled:opacity-60"
                      >
                        {mutation.isPending ? "Wird storniert…" : (info.fee_applies ? `Ja, CHF ${(info.fee_amount / 100).toFixed(2)} belasten & stornieren` : "Ja, jetzt stornieren")}
                      </button>
                      <button
                        type="button"
                        disabled={mutation.isPending}
                        onClick={() => setConfirming(false)}
                        className="rounded-full border border-white/20 px-5 py-2.5 text-sm uppercase tracking-widest hover:bg-white/5"
                      >
                        Abbrechen
                      </button>
                    </div>
                  </>
                )}
              </div>

              <p className="mt-6 text-xs text-muted-foreground">
                Kostenlose Stornierung ist bis 7 Tage vor dem Anlass möglich. Bei
                späterer Stornierung eines kostenpflichtigen Anlasses oder bei
                No-Show können CHF 50 pro Person belastet werden.
              </p>
            </>
          );
        })()}
      </div>
    </div>
  );
}
