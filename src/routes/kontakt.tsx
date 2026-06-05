import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { publicDataQuery } from "@/lib/queries";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { MapPin, Phone, Mail, Clock } from "lucide-react";

export const Route = createFileRoute("/kontakt")({
  head: () => ({
    meta: [
      { title: "Kontakt — Balkaneros" },
      { name: "description", content: "Adresse, Telefon und Öffnungszeiten von Balkaneros in Rothenburg." },
      { property: "og:title", content: "Kontakt — Balkaneros" },
      { property: "og:description", content: "So erreichst du uns." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(publicDataQuery),
  component: Contact,
  errorComponent: ({ error }) => <div className="p-10">Fehler: {error.message}</div>,
});

function extractMapsSrc(input: string): string {
  if (!input) return "";
  const s = input.trim();
  const m = s.match(/src=["']([^"']+)["']/i);
  return m ? m[1] : s;
}

function Contact() {
  const { data } = useSuspenseQuery(publicDataQuery);
  const { contact, hours } = data;
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <section className="pt-40 pb-16 px-6">
        <div className="mx-auto max-w-6xl">
          <p className="text-gold tracking-[0.3em] uppercase text-xs mb-4 text-center">Kontakt</p>
          <h1 className="font-display text-5xl md:text-6xl text-center mb-16">Besuche uns</h1>
          <div className="grid md:grid-cols-2 gap-12">
            <div className="space-y-8">
              <div className="flex gap-4">
                <MapPin className="w-6 h-6 text-gold shrink-0 mt-1" />
                <div>
                  <h3 className="font-display text-xl mb-1">Adresse</h3>
                  <p className="text-muted-foreground">
                    {contact.restaurant_name}<br />
                    {contact.address_line1}<br />
                    {contact.address_line2 && <>{contact.address_line2}<br /></>}
                    {contact.postal_code} {contact.city}
                  </p>
                </div>
              </div>
              {contact.phone && (
                <div className="flex gap-4">
                  <Phone className="w-6 h-6 text-gold shrink-0 mt-1" />
                  <div>
                    <h3 className="font-display text-xl mb-1">Telefon</h3>
                    <a href={`tel:${contact.phone}`} className="text-muted-foreground hover:text-gold">{contact.phone}</a>
                  </div>
                </div>
              )}
              {contact.email && (
                <div className="flex gap-4">
                  <Mail className="w-6 h-6 text-gold shrink-0 mt-1" />
                  <div>
                    <h3 className="font-display text-xl mb-1">E-Mail</h3>
                    <a href={`mailto:${contact.email}`} className="text-muted-foreground hover:text-gold">{contact.email}</a>
                  </div>
                </div>
              )}
              {contact.hours_public_visible !== false && (
                <div className="flex gap-4">
                  <Clock className="w-6 h-6 text-gold shrink-0 mt-1" />
                  <div>
                    <h3 className="font-display text-xl mb-3">Öffnungszeiten</h3>
                    <ul className="space-y-1 text-muted-foreground">
                      {hours.map((h) => (
                        <li key={h.weekday} className="flex justify-between gap-8">
                          <span>{h.label}</span>
                          <span>{h.is_closed ? "geschlossen" : `${h.open_time} – ${h.close_time}`}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              <Link to="/reservieren" className="inline-flex items-center rounded-full bg-gold px-8 py-3.5 text-sm font-medium uppercase tracking-widest text-gold-foreground hover:opacity-90 transition">
                Tisch reservieren
              </Link>
            </div>
            <div className="aspect-square md:aspect-auto md:min-h-[500px] bg-card rounded-sm overflow-hidden">
              {extractMapsSrc(contact.maps_embed_url) ? (
                <iframe
                  src={extractMapsSrc(contact.maps_embed_url)}
                  className="w-full h-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                  title="Karte"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm p-6 text-center">
                  Karte verfügbar nach Konfiguration im Admin.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
      <SiteFooter contact={contact} hours={hours} />
    </div>
  );
}
