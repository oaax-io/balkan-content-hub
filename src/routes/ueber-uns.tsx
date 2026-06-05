import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { publicDataQuery } from "@/lib/queries";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import offerBrunch from "@/assets/offer-brunch.jpg";

import { buildSeoMeta } from "@/lib/seo-head";

export const Route = createFileRoute("/ueber-uns")({
  head: ({ loaderData }) => ({
    meta: buildSeoMeta(loaderData, "/ueber-uns", {
      title: "Über uns — Balkaneros",
      description: "Seit 2019 mit dem Balkaneros Dinner in der Schweiz unterwegs. Lerne unsere Geschichte und Gastgeberin Nena Spadea kennen.",
    }),
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(publicDataQuery),
  component: About,
  errorComponent: ({ error }) => <div className="p-10">Fehler: {error.message}</div>,
});

function About() {
  const { data } = useSuspenseQuery(publicDataQuery);
  const { content, contact, hours } = data;
  const heroImg =
    content.about_hero_image ||
    content.about_image ||
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1800&q=80";
  const hostImg =
    content.host_image ||
    "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=900&q=80";

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
          <h1 className="font-display text-5xl md:text-6xl mb-6">
            {content.about_title || "Ein paar Worte über uns"}
          </h1>
          {content.about_subtitle && (
            <p className="text-lg md:text-xl text-white/85 max-w-2xl mx-auto">
              {content.about_subtitle}
            </p>
          )}
        </div>
      </section>

      {/* Balkaneros? */}
      <section
        className="relative py-24 px-6 bg-background text-foreground"
        style={{ backgroundImage: `linear-gradient(rgba(20,15,10,0.88), rgba(20,15,10,0.88)), url(${offerBrunch})`, backgroundSize: "cover", backgroundPosition: "center" }}
      >
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-gold tracking-[0.3em] uppercase text-xs mb-4">
            {content.about_eyebrow || "Wer sind die Balkaneros?"}
          </p>
          <h2 className="font-display text-4xl md:text-5xl mb-10">Balkaneros?</h2>
          <div className="text-muted-foreground leading-relaxed text-lg whitespace-pre-line">
            {content.about_text}
          </div>
        </div>
      </section>

      {/* Gastgeberin */}
      <section className="py-24 px-6">
        <div className="mx-auto max-w-6xl grid md:grid-cols-2 gap-12 items-center">
          <div className="aspect-[4/5] overflow-hidden rounded-sm shadow-2xl">
            <img src={hostImg} alt={content.host_name || "Gastgeberin"} className="w-full h-full object-cover" />
          </div>
          <div>
            <p className="text-gold tracking-[0.3em] uppercase text-xs mb-4">
              {content.host_eyebrow || "Gastgeberin"}
            </p>
            <h2 className="font-display text-4xl md:text-5xl mb-6">
              {content.host_name || content.host_title}
            </h2>
            <p className="text-muted-foreground leading-relaxed text-lg whitespace-pre-line">
              {content.host_text}
            </p>
          </div>
        </div>
      </section>

      <SiteFooter contact={contact} hours={hours} />
    </div>
  );
}
