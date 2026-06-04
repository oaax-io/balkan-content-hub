import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { publicDataQuery } from "@/lib/queries";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";

export const Route = createFileRoute("/brunch")({
  head: () => ({
    meta: [
      { title: "Brunch — Balkaneros" },
      { name: "description", content: "Hausgemachte Brunch-Köstlichkeiten aus dem Balkan – traditionell, modern und voller Geschmack." },
      { property: "og:title", content: "Brunch — Balkaneros" },
      { property: "og:description", content: "Balkan Brunch in Luzern – herzhaft, gemütlich, authentisch." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(publicDataQuery),
  component: BrunchPage,
  errorComponent: ({ error }) => <div className="p-10">Fehler: {error.message}</div>,
});

function BrunchPage() {
  const { data } = useSuspenseQuery(publicDataQuery);
  const { content, contact, hours } = data;
  const heroImg =
    content.brunch_image ||
    "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=1800&q=80";

  const features = [
    {
      title: content.brunch_feature1_title,
      text: content.brunch_feature1_text,
      img: content.brunch_feature1_image || "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=1200&q=80",
    },
    {
      title: content.brunch_feature2_title,
      text: content.brunch_feature2_text,
      img: content.brunch_feature2_image || "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=1200&q=80",
      reverse: true,
    },
    {
      title: content.brunch_feature3_title,
      text: content.brunch_feature3_text,
      img: content.brunch_feature3_image || "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1200&q=80",
    },
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
            {content.brunch_eyebrow}
          </p>
          <h1 className="font-display text-5xl md:text-6xl mb-4">
            {content.brunch_title}
          </h1>
          {content.brunch_subtitle && (
            <p className="text-lg md:text-xl text-white/85 mb-8">{content.brunch_subtitle}</p>
          )}
          <p className="text-base md:text-lg text-white/80 max-w-3xl mx-auto whitespace-pre-line">
            {content.brunch_intro}
          </p>
          <div className="mt-10">
            <Link
              to="/reservieren"
              className="inline-flex items-center rounded-full bg-gold px-10 py-4 text-sm font-medium uppercase tracking-widest text-gold-foreground hover:opacity-90 transition"
            >
              Jetzt reservieren
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
            Sichere Dir Deinen Brunch-Platz
          </h2>
          <p className="text-lg text-muted-foreground mb-10">
            Reserviere jetzt und starte entspannt in den Tag.
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
