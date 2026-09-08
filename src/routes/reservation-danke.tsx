import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getReservationBySessionId } from "@/lib/reservations.functions";
import { SiteHeader } from "@/components/site/SiteHeader";
import { CheckCircle2, Mail, Ticket } from "lucide-react";

export const Route = createFileRoute("/reservation-danke")({
  head: () => ({
    meta: [
      { title: "Reservation bestätigt · Balkaneros Events" },
      { name: "description", content: "Danke für deine Reservation bei Balkaneros Events. Dein Ticket ist bezahlt und deine Bestätigung ist unterwegs." },
      { property: "og:title", content: "Reservation bestätigt · Balkaneros Events" },
      { property: "og:description", content: "Dein Ticket ist bezahlt — die Bestätigung kommt per E-Mail." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  component: Page,
});

function Page() {
  const { session_id } = Route.useSearch();
  const fn = useServerFn(getReservationBySessionId);
  type Result = Awaited<ReturnType<typeof fn>>;
  const { data, isLoading } = useQuery<Result>({
    queryKey: ["reservation-return", session_id],
    queryFn: () => (session_id ? fn({ data: { sessionId: session_id } }) : Promise.resolve({ found: false } as Result)),
    refetchInterval: (q) => {
      const d = q.state.data;
      if (d && d.found && d.reservation?.ticket_payment_status === "paid") return false;
      return 3000;
    },
    enabled: !!session_id,
  });

  const paid = data?.found && data.reservation?.ticket_payment_status === "paid";

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="flex-1 flex items-center justify-center px-4 pt-32 pb-20">
        <div className="max-w-lg w-full text-center border border-gold/30 rounded-sm p-10 bg-card/50 backdrop-blur">
          <div className="w-16 h-16 rounded-full bg-gold/15 flex items-center justify-center mx-auto mb-6">
            {paid ? <CheckCircle2 className="w-8 h-8 text-gold" /> : <Ticket className="w-8 h-8 text-gold animate-pulse" />}
          </div>
          <p className="text-gold tracking-[0.3em] uppercase text-[10px] mb-3">Balkaneros Reservation</p>
          <h1 className="font-display text-3xl sm:text-4xl mb-4">
            {isLoading || !data?.found ? "Zahlung wird verarbeitet …" : paid ? "Hvala – bis bald!" : "Reservation erhalten"}
          </h1>
          {data?.found && data.reservation && (
            <div className="space-y-3 text-muted-foreground">
              <p className="text-cream">
                {data.reservation.occasion}
                {data.reservation.event_date_label ? ` · ${data.reservation.event_date_label}` : ""} ·{" "}
                {data.reservation.party_size} {data.reservation.party_size === 1 ? "Person" : "Personen"}
              </p>
              {paid && (
                <p className="text-sm">
                  Bezahlt: <span className="text-gold">CHF {(data.reservation.ticket_total_rappen / 100).toFixed(2)}</span>
                </p>
              )}
              <p className="text-sm inline-flex items-center gap-2 justify-center">
                <Mail className="w-4 h-4 text-gold" />
                Bestätigung an <span className="text-cream">{data.reservation.guest_email}</span>
              </p>
            </div>
          )}
          <div className="pt-8">
            <Link to="/" className="inline-block rounded-full border border-gold/50 px-6 py-3 text-xs uppercase tracking-widest hover:bg-gold hover:text-gold-foreground transition">
              Zur Startseite
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
