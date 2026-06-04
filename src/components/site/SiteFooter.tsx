import { Link } from "@tanstack/react-router";
import { useState } from "react";
import type { ContactInfo, OpeningHour } from "@/lib/public.functions";
import { Instagram, Facebook, Youtube, MapPin, Phone, Mail, Send } from "lucide-react";
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
    <footer className="mt-24 bg-[oklch(0.93_0.015_80)] text-[oklch(0.2_0.01_60)]">
      {/* Newsletter */}
      <div className="border-b border-[oklch(0.85_0.02_75)]">
        <div className="mx-auto max-w-7xl px-6 py-12 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <h3 className="font-display text-2xl md:text-3xl text-[oklch(0.25_0.01_60)]">Newsletter abonnieren</h3>
            <p className="text-sm text-[oklch(0.4_0.01_60)] mt-1">Erhalte Neuigkeiten zu Events und Angeboten.</p>
          </div>
          <form onSubmit={handleSubmit} className="flex gap-2 w-full md:w-auto md:min-w-[400px]">
            <Input
              type="email"
              required
              placeholder="Deine E-Mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-white/70 border-[oklch(0.85_0.02_75)] text-[oklch(0.2_0.01_60)] placeholder:text-[oklch(0.5_0.01_60)]"
            />
            <Button type="submit" className="bg-gold text-gold-foreground hover:bg-gold/90 gap-2">
              <Send className="w-4 h-4" /> Anmelden
            </Button>
          </form>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-16 grid gap-12 md:grid-cols-4">
        <div className="md:col-span-1">
          <img
            src={logo}
            alt={contact.restaurant_name}
            className="h-16 w-auto mb-4"
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
        <div className="text-sm space-y-2">
          <h4 className="uppercase tracking-widest text-xs text-[oklch(0.45_0.08_75)] mb-3 font-semibold">Kontakt</h4>
          {contact.phone && <p className="flex items-center gap-2"><Phone className="w-4 h-4" /> <a href={`tel:${contact.phone}`} className="hover:text-gold">{contact.phone}</a></p>}
          {contact.email && <p className="flex items-center gap-2"><Mail className="w-4 h-4" /> <a href={`mailto:${contact.email}`} className="hover:text-gold">{contact.email}</a></p>}
          <div className="flex gap-3 pt-2">
            {contact.instagram_url && <a href={contact.instagram_url} target="_blank" rel="noopener noreferrer" aria-label="Instagram"><Instagram className="w-5 h-5 hover:text-gold transition-colors" /></a>}
            {contact.facebook_url && <a href={contact.facebook_url} target="_blank" rel="noopener noreferrer" aria-label="Facebook"><Facebook className="w-5 h-5 hover:text-gold transition-colors" /></a>}
            <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" aria-label="YouTube"><Youtube className="w-5 h-5 hover:text-gold transition-colors" /></a>
          </div>
        </div>
        <div className="text-sm md:col-span-2">
          <h4 className="uppercase tracking-widest text-xs text-[oklch(0.45_0.08_75)] mb-3 font-semibold">Öffnungszeiten</h4>
          <ul className="space-y-1">
            {hours.map((h) => (
              <li key={h.weekday} className="flex justify-between gap-4">
                <span className="text-[oklch(0.4_0.01_60)]">{h.label}</span>
                <span>{h.is_closed ? "geschlossen" : `${h.open_time} – ${h.close_time}`}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-[oklch(0.85_0.02_75)]">
        <div className="mx-auto max-w-7xl px-6 py-5 flex flex-col sm:flex-row justify-between gap-2 text-xs text-[oklch(0.4_0.01_60)]">
          <p>© {new Date().getFullYear()} Fine Moments GmbH (AMAYA weg). Alle Rechte vorbehalten.</p>
          <Link to="/admin" className="hover:text-gold">Admin</Link>
        </div>
      </div>
    </footer>
  );
}
