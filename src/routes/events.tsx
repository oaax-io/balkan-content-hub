import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { publicDataQuery } from "@/lib/queries";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";

export const Route = createFileRoute("/events")({
  head: () => ({
    meta: [
      { title: "Events & Feste — Balkaneros" },
      { name: "description", content: "Geburtstage, Hochzeiten, Firmenanlässe – feiere deinen Anlass im Balkaneros." },
      { property: "og:title", content: "Events & Feste — Balkaneros" },
      { property: "og:description", content: "Feiere deinen Anlass im Balkaneros." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(publicDataQuery),
  component: EventsPage,
  errorComponent: ({ error }) => <div className="p-10">Fehler: {error.message}</div>,
});

function EventsPage() {
  const { data } = useSuspenseQuery(publicDataQuery);
  const { content, contact, hours } = data;
  const img =
    content.events_image ||
    "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=1400&q=80";
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <section className="pt-40 pb-16 px-6">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-gold tracking-[0.3em] uppercase text-xs mb-4">
            {content.events_eyebrow}
          </p>
          <h1 className="font-display text-5xl md:text-6xl mb-8">
            {content.events_title}
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto whitespace-pre-line">
            {content.events_intro}
          </p>
        </div>
      </section>
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-5xl">
          <div className="aspect-[16/9] overflow-hidden rounded-sm mb-12">
            <img src={img} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="prose prose-invert max-w-3xl mx-auto text-lg text-muted-foreground leading-relaxed whitespace-pre-line">
            {content.events_text}
          </div>
          <div className="text-center mt-12">
            <Link
              to="/kontakt"
              className="inline-flex items-center rounded-full bg-gold px-8 py-3 text-sm font-medium uppercase tracking-widest text-gold-foreground hover:opacity-90 transition"
            >
              Anfrage senden
            </Link>
          </div>
        </div>
      </section>
      <SiteFooter contact={contact} hours={hours} />
    </div>
  );
}
