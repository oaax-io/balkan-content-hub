import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { publicDataQuery } from "@/lib/queries";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";

export const Route = createFileRoute("/ueber-uns")({
  head: () => ({
    meta: [
      { title: "Über uns — Balkaneros" },
      { name: "description", content: "Die Geschichte hinter Balkaneros: traditionelle Balkan-Küche mit modernem Erlebnis." },
      { property: "og:title", content: "Über uns — Balkaneros" },
      { property: "og:description", content: "Die Geschichte hinter Balkaneros." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(publicDataQuery),
  component: About,
  errorComponent: ({ error }) => <div className="p-10">Fehler: {error.message}</div>,
});

function About() {
  const { data } = useSuspenseQuery(publicDataQuery);
  const { content, contact, hours } = data;
  const img = content.about_image || content.intro_image || "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1400&q=80";
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <section className="pt-40 pb-24 px-6">
        <div className="mx-auto max-w-5xl">
          <p className="text-gold tracking-[0.3em] uppercase text-xs mb-4 text-center">Naša priča</p>
          <h1 className="font-display text-5xl md:text-6xl text-center mb-16">{content.about_title}</h1>
          <div className="aspect-[16/9] overflow-hidden rounded-sm mb-12">
            <img src={img} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="prose prose-invert max-w-3xl mx-auto text-lg text-muted-foreground leading-relaxed whitespace-pre-line">
            {content.about_text}
          </div>
        </div>
      </section>
      <SiteFooter contact={contact} hours={hours} />
    </div>
  );
}
