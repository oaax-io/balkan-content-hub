import { useState } from "react";
import type { ContactInfo, OpeningHour } from "@/lib/public.functions";
import { Instagram, Facebook, Youtube, MapPin, Phone, Mail, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import logo from "@/assets/logo.webp";

export function SiteFooter({ contact, hours: _hours }: { contact: ContactInfo; hours: OpeningHour[] }) {
  const [email, setEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    toast.success("Danke für deine Anmeldung!");
    setEmail("");
  };

  const instagramUrl = contact.instagram_url || "https://instagram.com";
  const facebookUrl = contact.facebook_url || "https://facebook.com";
  const youtubeUrl = "https://youtube.com";

  return (
    <footer className="mt-24 text-[oklch(0.2_0.01_60)]">
      {/* Newsletter */}
      <div className="bg-[oklch(0.95_0.012_80)] border-y border-[oklch(0.88_0.02_75)]">
        <div className="mx-auto max-w-7xl px-6 py-14 flex flex-col md:flex-row md:items-center md:justify-between gap-8">
          <div className="space-y-2 text-center md:text-left">
            <h3 className="font-display text-2xl md:text-3xl text-[oklch(0.2_0.01_60)]">Bleib auf dem Laufenden</h3>
            <p className="text-sm text-[oklch(0.4_0.01_60)] max-w-md">Erhalte Neuigkeiten zu Events, exklusiven Angeboten und besonderen Menüs direkt in dein Postfach.</p>
          </div>
          <form onSubmit={handleSubmit} className="flex gap-2 w-full md:w-auto md:min-w-[420px]">
            <Input
              type="email"
              required
              placeholder="Deine E-Mail-Adresse"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-white border-[oklch(0.85_0.02_75)] text-[oklch(0.2_0.01_60)] placeholder:text-[oklch(0.55_0.01_60)] focus-visible:ring-gold"
            />
            <Button type="submit" className="bg-gold text-gold-foreground hover:bg-gold/90 gap-2 px-6">
              Anmelden <ArrowRight className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </div>

      {/* Footer content */}
      <div className="bg-[oklch(0.93_0.015_80)]">
        <div className="mx-auto max-w-7xl px-6 py-14 grid gap-10 md:grid-cols-3">
          {/* Logo + Address (centered) */}
          <div className="md:col-span-1 flex flex-col items-center text-center space-y-4">
            <img
              src={logo}
              alt="Balkaneros"
              className="h-16 w-auto"
              style={{ filter: "brightness(0.35) sepia(1) hue-rotate(5deg) saturate(2)" }}
            />
            <p className="text-sm text-[oklch(0.4_0.01_60)] max-w-xs">
              Seit 2019 sind wir in diversen Locations in der Schweiz mit unserem Balkaneros Dinner unterwegs
            </p>
            <p className="text-sm text-[oklch(0.4_0.01_60)] flex items-start gap-2 justify-center">
              <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                Kaspar-Koppstrasse 90<br />
                CH-6030 Ebikon
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
                <a href="mailto:info@balkaneros.ch" className="hover:text-gold transition-colors">info@balkaneros.ch</a>
              </p>
            )}
          </div>

          {/* Social Media */}
          <div className="text-sm space-y-3">
            <h4 className="uppercase tracking-widest text-xs text-[oklch(0.45_0.08_75)] mb-3 font-semibold">Social Media</h4>
            <div className="flex gap-4">
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="w-10 h-10 rounded-full bg-[oklch(0.85_0.02_75)] flex items-center justify-center hover:bg-gold hover:text-gold-foreground transition-all"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <a
                href={facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="w-10 h-10 rounded-full bg-[oklch(0.85_0.02_75)] flex items-center justify-center hover:bg-gold hover:text-gold-foreground transition-all"
              >
                <Facebook className="w-5 h-5" />
              </a>
              <a
                href={youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="YouTube"
                className="w-10 h-10 rounded-full bg-[oklch(0.85_0.02_75)] flex items-center justify-center hover:bg-gold hover:text-gold-foreground transition-all"
              >
                <Youtube className="w-5 h-5" />
              </a>
            </div>
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
