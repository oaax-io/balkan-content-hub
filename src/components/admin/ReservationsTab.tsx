import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listReservations, updateReservationStatus } from "@/lib/reservations.functions";
import { toast } from "sonner";
import { Check, X, Phone, Mail, Users, Calendar } from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700 border-yellow-300",
  confirmed: "bg-green-100 text-green-700 border-green-300",
  declined: "bg-red-100 text-red-700 border-red-300",
  cancelled: "bg-gray-100 text-gray-600 border-gray-300",
};
const STATUS_LABEL: Record<string, string> = {
  pending: "Neu", confirmed: "Bestätigt", declined: "Abgelehnt", cancelled: "Storniert",
};

export function ReservationsTab() {
  const listFn = useServerFn(listReservations);
  const updFn = useServerFn(updateReservationStatus);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["reservations"], queryFn: () => listFn() });
  const [filter, setFilter] = useState<string>("all");
  const [busy, setBusy] = useState<string | null>(null);

  async function setStatus(id: string, status: "confirmed" | "declined" | "pending" | "cancelled") {
    setBusy(id);
    try {
      await updFn({ data: { id, status } });
      toast.success(status === "confirmed" ? "Bestätigt – E-Mail an Gast gesendet" : `Status: ${STATUS_LABEL[status]}`);
      qc.invalidateQueries({ queryKey: ["reservations"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Fehler"); }
    finally { setBusy(null); }
  }

  if (isLoading) return <p className="text-muted-foreground">Lade …</p>;
  const items = (data ?? []).filter((r) => filter === "all" || r.status === filter);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-2xl">Reservierungen</h2>
        <div className="flex gap-1 text-xs">
          {["all", "pending", "confirmed", "declined"].map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full border ${filter === f ? "bg-gold text-gold-foreground border-gold" : "border-border text-muted-foreground hover:text-foreground"}`}>
              {f === "all" ? "Alle" : STATUS_LABEL[f]}
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">Keine Reservierungen.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((r) => (
            <li key={r.id} className="bg-card border border-border rounded-sm p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-display text-lg">{r.guest_name}</h3>
                    <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border ${STATUS_STYLES[r.status]}`}>
                      {STATUS_LABEL[r.status]}
                    </span>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-2"><Calendar className="w-4 h-4" /> {fmt(r.reservation_date)} · {r.reservation_time}</span>
                    <span className="flex items-center gap-2"><Users className="w-4 h-4" /> {r.party_size} Personen</span>
                    <a href={`mailto:${r.guest_email}`} className="flex items-center gap-2 hover:text-gold"><Mail className="w-4 h-4" /> {r.guest_email}</a>
                    {r.guest_phone && <a href={`tel:${r.guest_phone}`} className="flex items-center gap-2 hover:text-gold"><Phone className="w-4 h-4" /> {r.guest_phone}</a>}
                  </div>
                  {r.notes && <p className="mt-3 text-sm bg-background border border-border rounded-sm p-3 text-muted-foreground">{r.notes}</p>}
                </div>
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
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function fmt(d: string) {
  try { return new Date(d + "T00:00:00").toLocaleDateString("de-CH", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }); }
  catch { return d; }
}
