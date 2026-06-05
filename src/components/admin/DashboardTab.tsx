import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listReservations } from "@/lib/reservations.functions";
import { CalendarCheck, Clock, Users, TrendingUp, Mail, Phone } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function DashboardTab({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const listFn = useServerFn(listReservations);
  const { data, isLoading } = useQuery({ queryKey: ["reservations"], queryFn: () => listFn() });

  if (isLoading) return <p className="text-muted-foreground">Lade …</p>;
  const items = data ?? [];

  const today = new Date().toISOString().slice(0, 10);
  const pending = items.filter((r) => r.status === "pending");
  const confirmed = items.filter((r) => r.status === "confirmed");
  const todayCount = items.filter((r) => r.reservation_date === today && r.status !== "declined" && r.status !== "cancelled").length;
  const upcoming = items
    .filter((r) => r.reservation_date >= today && r.status !== "declined" && r.status !== "cancelled")
    .sort((a, b) => (a.reservation_date + a.reservation_time).localeCompare(b.reservation_date + b.reservation_time))
    .slice(0, 6);
  const last7 = (() => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    const cutoff = d.toISOString();
    return items.filter((r) => r.created_at >= cutoff).length;
  })();

  const stats = [
    { label: "Heute", value: todayCount, icon: CalendarCheck, hint: "Reservierungen heute" },
    { label: "Offen", value: pending.length, icon: Clock, hint: "Noch zu bestätigen", accent: pending.length > 0 },
    { label: "Bestätigt", value: confirmed.length, icon: Users, hint: "Gesamt bestätigt" },
    { label: "Letzte 7 Tage", value: last7, icon: TrendingUp, hint: "Neue Anfragen" },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h2 className="font-display text-3xl">Übersicht</h2>
        <p className="text-sm text-muted-foreground mt-1">Willkommen zurück. Hier ist der Stand deines Restaurants.</p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className={`bg-card border rounded-sm p-5 ${s.accent ? "border-gold/60" : "border-border"}`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">{s.label}</span>
              <s.icon className={`w-4 h-4 ${s.accent ? "text-gold" : "text-muted-foreground"}`} />
            </div>
            <div className="font-display text-4xl">{s.value}</div>
            <p className="text-xs text-muted-foreground mt-2">{s.hint}</p>
          </div>
        ))}
      </div>

      <section className="grid lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-xl">Offene Anfragen</h3>
            <button onClick={() => onNavigate("reservations")} className="text-xs uppercase tracking-widest text-gold hover:opacity-80">Alle ansehen →</button>
          </div>
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Keine offenen Anfragen 🎉</p>
          ) : (
            <ul className="divide-y divide-border">
              {pending.slice(0, 5).map((r) => (
                <li key={r.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{r.guest_name}</div>
                    <div className="text-xs text-muted-foreground">{fmtDate(r.reservation_date)} · {r.reservation_time} · {r.party_size}P</div>
                  </div>
                  <div className="flex gap-3 text-muted-foreground shrink-0">
                    <a href={`mailto:${r.guest_email}`} className="hover:text-gold"><Mail className="w-4 h-4" /></a>
                    {r.guest_phone && <a href={`tel:${r.guest_phone}`} className="hover:text-gold"><Phone className="w-4 h-4" /></a>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-card border border-border rounded-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-xl">Nächste Reservierungen</h3>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Keine bevorstehenden Reservierungen.</p>
          ) : (
            <ul className="divide-y divide-border">
              {upcoming.map((r) => (
                <li key={r.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{r.guest_name}</div>
                    <div className="text-xs text-muted-foreground">{fmtDate(r.reservation_date)} · {r.reservation_time}</div>
                  </div>
                  <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border ${r.status === "pending" ? "border-yellow-300 text-yellow-700 bg-yellow-100" : "border-green-300 text-green-700 bg-green-100"}`}>
                    {r.status === "pending" ? "Offen" : "Bestätigt"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="bg-card border border-border rounded-sm p-6">
        <h3 className="font-display text-xl mb-4">Schnellzugriff</h3>
        <div className="grid sm:grid-cols-3 gap-3">
          <Link to="/" className="rounded-sm border border-border hover:border-gold p-4 transition">
            <div className="text-sm font-medium">Website ansehen</div>
            <div className="text-xs text-muted-foreground mt-1">Öffentliche Ansicht</div>
          </Link>
          <button onClick={() => onNavigate("content")} className="text-left rounded-sm border border-border hover:border-gold p-4 transition">
            <div className="text-sm font-medium">Inhalte bearbeiten</div>
            <div className="text-xs text-muted-foreground mt-1">Texte & Bilder</div>
          </button>
          <button onClick={() => onNavigate("contact")} className="text-left rounded-sm border border-border hover:border-gold p-4 transition">
            <div className="text-sm font-medium">Öffnungszeiten</div>
            <div className="text-xs text-muted-foreground mt-1">Kontakt & Zeiten</div>
          </button>
        </div>
      </section>
    </div>
  );
}

function fmtDate(d: string) {
  try { return new Date(d + "T00:00:00").toLocaleDateString("de-CH", { day: "2-digit", month: "short" }); }
  catch { return d; }
}
