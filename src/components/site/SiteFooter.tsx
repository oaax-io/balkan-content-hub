import { useState } from "react";
import type { ContactInfo, OpeningHour } from "@/lib/public.functions";
import { Instagram, Facebook, Youtube, MapPin, Phone, Mail, Send, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import logo from "@/assets/logo.webp";

export function SiteFooter({ contact, hours }: { contact: ContactInfo; hours: OpeningHour[] }) {
  const [email, setEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    toast.success("Danke für deine Anmeldung!");
    setEmail("");
  };

  return (
    <footer className="mt-24 text-[oklch(0.2_0.01_60)]">
      {/* Newsletter */}
      <div className="bg-[oklch(0.25_0.02_70)] text-white">
        <div className="mx-auto max-w-7xl px-6 py-14 flex flex-col md:flex-row md:items-center md:justify-between gap-8">
          <div className="space-y-2">
            <h3 className="font-display text-2xl md:text-3xl text-white">Bleib auf dem Laufenden</h3>
            <p className="text-sm text-[oklch(0.75_0.01_80)] max-w-md">Erhalte Neuigkeiten zu Events, exklusiven Angeboten und besonderen Menüs direkt in dein Postfach.</p>
          </div>
          <form onSubmit={handleSubmit} className="flex gap-2 w-full md:w-auto md:min-w-[420px]">
            <Input
              type="email"
              required
              placeholder="Deine E-Mail-Adresse"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-white/10 border-white/20 text-white placeholder:text-white/50 focus-visible:ring-gold"
            />
            <Button type="submit" className="bg-gold text-gold-foreground hover:bg-gold/90 gap-2 px-6">
              Anmelden <ArrowRight className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </div>

      {/* Footer content */}
      <div className="bg-[oklch(0.93_0.015_80)]">
        <div className="mx-auto max-w-7xl px-6 py-14 grid gap-10 md:grid-cols-4">
          {/* Logo + Address */}
          <div className="md:col-span-1">
            <img
              src={logo}
              alt={contact.restaurant_name}
              className="h-14 w-auto mb-4"
              style={{ filter: "brightness(0.35) sepia(1) hue-rotate(5deg) saturate(2)" }}
            />
            <p className="text-sm text-[oklch(0.4_0.01_60)] flex items-start gap-2">
              <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                {contact.address_line1}<br />
                {contact.address_line2 && <>{contact.address_line2}<br /></>}
                {contact.postal_code} {contact.city}
              </span>
            </p>
          </div>

          {/* Kontakt */}
          <div className="text-sm space-y-3">
            <h4 className="uppercase tracking-widest text-xs text-[oklch(0.45_0.08_75)] mb-3 font-semibold">Kontakt</h4>
            {contact.phone && (
              <p className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                <a href={`tel:${contact.phone}`} className="hover:text-gold transition-colors">{contact.phone}</a>
              </p>
            )}
            {contact.email && (
              <p className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                <a href={`mailto:${contact.email}`} className="hover:text-gold transition-colors">{contact.email}</a>
              </p>
            )}
          </div>

          {/* Social Media */}
          <div className="text-sm space-y-3">
            <h4 className="uppercase tracking-widest text-xs text-[oklch(0.45_0.08_75)] mb-3 font-semibold">Social Media</h4>
            <div className="flex gap-4">
              {contact.instagram_url && (
                <a
                  href={contact.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="w-10 h-10 rounded-full bg-[oklch(0.85_0.02_75)] flex items-center justify-center hover:bg-gold hover:text-gold-foreground transition-all"
                >
                  <Instagram className="w-5 h-5" />
                </a>
              )}
              {contact.facebook_url && (
                <a
                  href={contact.facebook_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className="w-10 h-10 rounded-full bg-[oklch(0.85_0.02_75)] flex items-center justify-center hover:bg-gold hover:text-gold-foreground transition-all"
                >
                  <Facebook className="w-5 h-5" />
                </a>
              )}
              <a
                href="https://youtube.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="YouTube"
                className="w-10 h-10 rounded-full bg-[oklch(0.85_0.02_75)] flex items-center justify-center hover:bg-gold hover:text-gold-foreground transition-all"
              >
                <Youtube className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Öffnungszeiten */}
          <div className="text-sm md:col-span-1">
            <h4 className="uppercase tracking-widest text-xs text-[oklch(0.45_0.08_75)] mb-3 font-semibold">Öffnungszeiten</h4>
            <ul className="space-y-1.5">
              {hours.map((h) => (
                <li key={h.weekday} className="flex justify-between gap-4">
                  <span className="text-[oklch(0.4_0.01_60)]">{h.label}</span>
                  <span>{h.is_closed ? "geschlossen" : `${h.open_time} – ${h.close_time}`}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div className="bg-[oklch(0.93_0.015_80)] border-t border-[oklch(0.85_0.02_75)]">
        <div className="mx-auto max-w-7xl px-6 py-5 text-center text-xs text-[oklch(0.4_0.01_60)]">
          <p>© {new Date().getFullYear()} Fine Moments GmbH. Alle Rechte vorbehalten.</p>
        </div>
      </div>
    </footer>
  );
}
