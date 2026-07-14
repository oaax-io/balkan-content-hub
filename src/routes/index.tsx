import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { publicDataQuery } from "@/lib/queries";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { HeroSlider } from "@/components/site/HeroSlider";
import { ReservationCard } from "@/components/site/ReservationCard";
import offerBrunch from "@/assets/offer-brunch.jpg";
import offerDinner from "@/assets/offer-dinner.jpg";
import offerEvents from "@/assets/offer-events.jpg";
import lupStudios8 from "@/assets/lupstudios-8.png.asset.json";
import luzPalokaj20 from "@/assets/luzpalokaj-photography-20.jpg.asset.json";

import { buildSeoMeta } from "@/lib/seo-head";

export const Route = createFileRoute("/")({
  head: ({ loaderData }) => ({
    meta: buildSeoMeta(loaderData, "/", {
      title: "Balkaneros — Köstlichkeiten aus dem Herzen des Balkans",
      description: "Hausgemachte Balkan-Küche bei Balkaneros in Rothenburg. Jetzt Tisch reservieren.",
    }),
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(publicDataQuery),
  component: Home,
  errorComponent: ({ error }) => <div className="p-10">Fehler: {error.message}</div>,
});

function Home() {
  const { data } = useSuspenseQuery(publicDataQuery);
  const { content } = data;

  const sliderImages = [content.slider_1, content.slider_2, content.slider_3, content.hero_image, lupStudios8.url].filter(Boolean) as string[];
  const introImg = content.intro_image || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80";
  const hostImg = content.host_image || "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=800&q=80";
  const galleries = [content.gallery_1, content.gallery_2, content.gallery_3].filter(Boolean);
  const eventDates = (content.reservation_event_dates || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const disclaimer = content.reservation_disclaimer || "";
  const occasions = (content.reservation_occasions || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const occasionsWithDates = (content.reservation_occasions_with_dates || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const paidOccasions = (content.reservation_paid_occasions || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <HeroSlider
        images={sliderImages}
        eyebrow={content.hero_eyebrow}
        title={content.hero_title}
        subtitle={content.hero_subtitle}
      >
        <ReservationCard
          eventDates={eventDates}
          disclaimer={disclaimer}
          occasions={occasions}
          occasionsWithDates={occasionsWithDates}
          paidOccasions={paidOccasions}
          variant="overlay"
        />
      </HeroSlider>


      {/* Section 2 — Intro */}
      <section
        className="relative py-24 px-6 bg-background text-foreground"
        style={{ backgroundImage: `linear-gradient(rgba(20,15,10,0.88), rgba(20,15,10,0.88)), url(${offerBrunch})`, backgroundSize: "cover", backgroundPosition: "center" }}
      >
        <div className="relative mx-auto max-w-6xl grid md:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-gold tracking-[0.3em] uppercase text-xs mb-4">{content.intro_eyebrow}</p>
            <h2 className="font-display text-4xl md:text-5xl mb-6">{content.intro_title}</h2>
            <p className="text-muted-foreground leading-relaxed text-lg">{content.intro_text}</p>
          </div>
          <div className="aspect-[4/5] overflow-hidden rounded-sm shadow-xl">
            <img src={introImg} alt="" className="w-full h-full object-cover" />
          </div>
        </div>
      </section>

      {/* Section 3 — Gastgeberin & Wer sind die Balkaneros? */}
      <section
        className="relative py-24 px-6 bg-background text-foreground"
        style={{ backgroundImage: `linear-gradient(rgba(15,12,8,0.9), rgba(15,12,8,0.9)), url(${offerDinner})`, backgroundSize: "cover", backgroundPosition: "center" }}
      >
        <div className="relative mx-auto max-w-6xl grid md:grid-cols-2 gap-16 items-center">
          <div className="order-2 md:order-1 aspect-[4/5] overflow-hidden rounded-sm shadow-xl">
            <img src={hostImg} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="order-1 md:order-2">
            <p className="text-gold tracking-[0.3em] uppercase text-xs mb-4">{content.host_eyebrow}</p>
            <h2 className="font-display text-4xl md:text-5xl mb-6">{content.host_title}</h2>
            <p className="text-muted-foreground leading-relaxed text-lg">{content.host_text}</p>
          </div>
        </div>

        <div className="relative mx-auto max-w-4xl text-center mt-20 pt-16 border-t border-border/60">
          <p className="text-gold tracking-[0.3em] uppercase text-xs mb-4">{content.about_eyebrow || "Wer sind die Balkaneros?"}</p>
          <h2 className="font-display text-4xl md:text-5xl mb-8">{content.about_title}</h2>
          <div className="text-muted-foreground leading-relaxed text-lg whitespace-pre-line">{content.about_text}</div>
        </div>
      </section>

      {/* Section 4 — Angebote */}
      <section
        className="relative py-24 px-6 bg-background text-foreground"
        style={{ backgroundImage: `linear-gradient(rgba(12,10,8,0.9), rgba(12,10,8,0.9)), url(${offerEvents})`, backgroundSize: "cover", backgroundPosition: "center" }}
      >
        <div className="relative mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <p className="text-gold tracking-[0.3em] uppercase text-xs mb-4">{content.offers_eyebrow}</p>
            <h2 className="font-display text-4xl md:text-5xl">{content.offers_title}</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { to: "/brunch", label: content.offers_brunch_label, desc: content.offers_brunch_desc, cta: content.offers_brunch_cta, img: content.brunch_image || "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=1200&q=80" },
              { to: "/dinner", label: content.offers_dinner_label, desc: content.offers_dinner_desc, cta: content.offers_dinner_cta, img: content.dinner_image || "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80" },
              { to: "/events", label: content.offers_events_label, desc: content.offers_events_desc, cta: content.offers_events_cta, img: content.events_image || "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=1200&q=80" },
            ].map((card) => (
              <Link
                key={card.to}
                to={card.to}
                className="group relative flex flex-col overflow-hidden rounded-2xl bg-card shadow-xl shadow-black/5 ring-1 ring-border/60 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/10 transition-all duration-500"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img src={card.img} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                </div>
                <div className="p-8 flex flex-col flex-1 text-center">
                  <h3 className="font-display text-3xl mb-3">{card.label}</h3>
                  <p className="text-muted-foreground mb-8">{card.desc}</p>
                  <span className="mt-auto inline-flex items-center justify-center gap-2 text-gold text-sm font-medium uppercase tracking-widest group-hover:gap-3 transition-all">
                    {card.cta}
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery */}
      {galleries.length > 0 && (
        <section className="py-20 px-6 bg-card">
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

      <SiteFooter contact={data.contact} hours={data.hours} />
    </div>
  );
}
