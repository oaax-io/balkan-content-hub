import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { publicDataQuery } from "@/lib/queries";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import offerDinner from "@/assets/offer-dinner.jpg";

export const Route = createFileRoute("/dinner")({
  head: () => ({
    meta: [
      { title: "Dinner — Balkaneros" },
      { name: "description", content: "Balkaneros Dinner: moderne Balkan-Fusion-Küche mit Live-Musik, Wein und Rakija in Luzern." },
      { property: "og:title", content: "Dinner — Balkaneros" },
      { property: "og:description", content: "Balkan-Fusion-Dinner mit Live-Musik." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(publicDataQuery),
  component: DinnerPage,
  errorComponent: ({ error }) => <div className="p-10">Fehler: {error.message}</div>,
});

function DinnerPage() {
  const { data } = useSuspenseQuery(publicDataQuery);
  const { content, contact, hours } = data;
  const heroImg =
    content.dinner_image ||
    "https://images.unsplash.com/photo-1544025162-d76694265947?w=1800&q=80";
  const f1 = content.dinner_feature1_image || "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80";
  const f2 = content.dinner_feature2_image || "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1200&q=80";

  const features = [
    { title: content.dinner_feature1_title, text: content.dinner_feature1_text, img: f1 },
    { title: content.dinner_feature2_title, text: content.dinner_feature2_text, img: f2, reverse: true },
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
            {content.dinner_eyebrow}
          </p>
          <h1 className="font-display text-5xl md:text-6xl mb-4">
            {content.dinner_title}
          </h1>
          {content.dinner_subtitle && (
            <p className="text-lg md:text-xl text-white/85 mb-8">{content.dinner_subtitle}</p>
          )}
          <p className="text-base md:text-lg text-white/80 max-w-3xl mx-auto whitespace-pre-line">
            {content.dinner_intro}
          </p>
          <div className="mt-10">
            <Link
              to="/reservieren"
              className="inline-flex items-center rounded-full bg-gold px-10 py-4 text-sm font-medium uppercase tracking-widest text-gold-foreground hover:opacity-90 transition"
            >
              Dinner buchen
            </Link>
          </div>
        </div>
      </section>

      {/* Feature blocks */}
      <section className="py-20 px-6 bg-card">
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
      <section className="py-20 px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-4xl md:text-5xl mb-6">
            Reserviere Deinen Platz
          </h2>
          <p className="text-lg text-muted-foreground mb-10">
            Sichere Dir einen Tisch für den nächsten Balkaneros Dinner-Abend.
          </p>
          <Link
            to="/reservieren"
            className="inline-flex items-center rounded-full bg-gold px-10 py-4 text-sm font-medium uppercase tracking-widest text-gold-foreground hover:opacity-90 transition"
          >
            Tisch reservieren
          </Link>
        </div>
      </section>

      <SiteFooter contact={contact} hours={hours} />
    </div>
  );
}
