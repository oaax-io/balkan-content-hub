import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { publicDataQuery } from "@/lib/queries";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import offerEvents from "@/assets/offer-events.jpg";

export const Route = createFileRoute("/events")({
  head: () => ({
    meta: [
      { title: "Exklusiv Events — Balkaneros" },
      { name: "description", content: "Geburtstag, Familienfeier oder Firmenanlass – Balkan Dinner mit Live-Musik, ausgewählten Weinen und Rakija in Luzern." },
      { property: "og:title", content: "Exklusiv Events — Balkaneros" },
      { property: "og:description", content: "Dein exklusiver Balkaneros Event in Luzern." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(publicDataQuery),
  component: EventsPage,
  errorComponent: ({ error }) => <div className="p-10">Fehler: {error.message}</div>,
});

function EventsPage() {
  const { data } = useSuspenseQuery(publicDataQuery);
  const { content, contact, hours } = data;
  const heroImg =
    content.events_image ||
    "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=1800&q=80";
  const f1 = content.events_feature1_image || "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80";
  const f2 = content.events_feature2_image || "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=1200&q=80";
  const f3 = content.events_feature3_image || "https://images.unsplash.com/photo-1555244162-803834f70033?w=1200&q=80";

  const features = [
    { title: content.events_feature1_title, text: content.events_feature1_text, img: f1 },
    { title: content.events_feature2_title, text: content.events_feature2_text, img: f2, reverse: true },
    { title: content.events_feature3_title, text: content.events_feature3_text, img: f3 },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      {/* Hero */}
      <section
        className="relative pt-40 pb-32 px-6 text-white"
        style={{
          backgroundImage: `linear-gradient(rgba(15,12,8,0.65), rgba(15,12,8,0.65)), url(${heroImg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-gold tracking-[0.3em] uppercase text-xs mb-4">
            {content.events_eyebrow}
          </p>
          <h1 className="font-display text-5xl md:text-6xl mb-4">
            {content.events_title}
          </h1>
          {content.events_subtitle && (
            <p className="text-lg md:text-xl text-white/85 mb-8">{content.events_subtitle}</p>
          )}
          <p className="text-base md:text-lg text-white/80 max-w-3xl mx-auto whitespace-pre-line">
            {content.events_intro}
          </p>
        </div>
      </section>

      {/* Feature blocks */}
      <section
        className="relative py-20 px-6 bg-background text-foreground"
        style={{ backgroundImage: `linear-gradient(rgba(12,10,8,0.9), rgba(12,10,8,0.9)), url(${offerEvents})`, backgroundSize: "cover", backgroundPosition: "center" }}
      >
        <div className="mx-auto max-w-6xl space-y-20">
          {features.map((f, i) => (
            <div
              key={i}
              className={`grid md:grid-cols-2 gap-12 items-center ${f.reverse ? "md:[&>*:first-child]:order-2" : ""}`}
            >
              <div className="aspect-[4/3] overflow-hidden rounded-lg shadow-xl">
                <img src={f.img} alt={f.title || ""} className="w-full h-full object-cover" />
              </div>
              <div>
                <h2 className="font-display text-3xl md:text-4xl mb-6">{f.title}</h2>
                <p className="text-muted-foreground leading-relaxed text-lg whitespace-pre-line">
                  {f.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-4xl md:text-5xl mb-6">
            {content.events_cta_title}
          </h2>
          <p className="text-lg text-muted-foreground mb-10 whitespace-pre-line">
            {content.events_cta_text}
          </p>
          <Link
            to="/kontakt"
            className="inline-flex items-center rounded-full bg-gold px-10 py-4 text-sm font-medium uppercase tracking-widest text-gold-foreground hover:opacity-90 transition"
          >
            Reservieren
          </Link>
        </div>
      </section>

      <SiteFooter contact={contact} hours={hours} />
    </div>
  );
}
