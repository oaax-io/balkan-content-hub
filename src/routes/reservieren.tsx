import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { publicDataQuery } from "@/lib/queries";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { ReservationCard } from "@/components/site/ReservationCard";

export const Route = createFileRoute("/reservieren")({
  head: () => ({
    meta: [
      { title: "Reservieren — Balkaneros" },
      { name: "description", content: "Reserviere deinen Tisch bei Balkaneros." },
      { property: "og:title", content: "Reservieren — Balkaneros" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(publicDataQuery),
  component: Reserve,
  errorComponent: ({ error }) => <div className="p-10">Fehler: {error.message}</div>,
});

function Reserve() {
  const { data } = useSuspenseQuery(publicDataQuery);
  const { contact, hours, content } = data;
  const eventDates = (content.reservation_event_dates || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const disclaimer = content.reservation_disclaimer || "";
  const occasions = (content.reservation_occasions || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <section className="pt-32 pb-20 px-4 sm:px-6">
        <div className="mx-auto max-w-xl">
          <p className="text-gold tracking-[0.3em] uppercase text-xs mb-3 text-center">Reservierung</p>
          <h1 className="font-display text-4xl sm:text-5xl text-center mb-8">Tisch reservieren</h1>
          <ReservationCard eventDates={eventDates} disclaimer={disclaimer} occasions={occasions} variant="page" />
        </div>
      </section>
      <SiteFooter contact={contact} hours={hours} />
    </div>
  );
}
