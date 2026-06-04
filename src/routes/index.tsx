import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { publicDataQuery } from "@/lib/queries";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Balkaneros — Köstlichkeiten aus dem Herzen des Balkans" },
      { name: "description", content: "Hausgemachte Balkan-Küche bei Balkaneros in Rothenburg. Jetzt Tisch reservieren." },
      { property: "og:title", content: "Balkaneros — Homemade Cuisine" },
      { property: "og:description", content: "Hausgemachte Balkan-Küche in Rothenburg." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(publicDataQuery),
  component: Home,
  errorComponent: ({ error }) => <div className="p-10">Fehler: {error.message}</div>,
});

function Home() {
  const { data } = useSuspenseQuery(publicDataQuery);
  const { content, contact, hours } = data;
  const heroBg = content.hero_image || "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1920&q=80";
  const introImg = content.intro_image || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80";
  const galleries = [content.gallery_1, content.gallery_2, content.gallery_3].filter(Boolean);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      {/* Hero */}
      <section className="relative h-screen min-h-[640px] flex items-center justify-center">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroBg})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black/80" />
        <div className="relative z-10 text-center px-6 max-w-4xl">
          <p className="text-gold tracking-[0.3em] uppercase text-sm mb-6">{content.hero_eyebrow}</p>
          <h1 className="font-display text-5xl md:text-7xl leading-tight mb-6">{content.hero_title}</h1>
          <p className="text-lg md:text-xl text-foreground/80 max-w-2xl mx-auto mb-10">{content.hero_subtitle}</p>
          <Link
            to="/reservieren"
            className="inline-flex items-center gap-2 rounded-full bg-gold px-8 py-4 text-sm font-medium uppercase tracking-widest text-gold-foreground hover:opacity-90 transition"
          >
            {content.hero_cta_label || "Tisch reservieren"}
          </Link>
        </div>
      </section>

      {/* Intro */}
      <section className="py-24 px-6">
        <div className="mx-auto max-w-6xl grid md:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-gold tracking-[0.3em] uppercase text-xs mb-4">{content.intro_eyebrow}</p>
            <h2 className="font-display text-4xl md:text-5xl mb-6">{content.intro_title}</h2>
            <p className="text-muted-foreground leading-relaxed text-lg">{content.intro_text}</p>
          </div>
          <div className="aspect-[4/5] overflow-hidden rounded-sm">
            <img src={introImg} alt="" className="w-full h-full object-cover" />
          </div>
        </div>
      </section>

      {/* Gallery */}
      {galleries.length > 0 && (
        <section className="py-16 px-6 bg-card">
          <div className="mx-auto max-w-7xl">
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
              {galleries.map((src, i) => (
                <div key={i} className="aspect-square overflow-hidden rounded-sm">
                  <img src={src} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <SiteFooter contact={contact} hours={hours} />
    </div>
  );
}
