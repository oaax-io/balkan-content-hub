import { Link } from "@tanstack/react-router";
import type { ContactInfo, OpeningHour } from "@/lib/public.functions";
import { Instagram, Facebook, MapPin, Phone, Mail } from "lucide-react";

export function SiteFooter({ contact, hours }: { contact: ContactInfo; hours: OpeningHour[] }) {
  return (
    <footer className="border-t border-border bg-card mt-24">
      <div className="mx-auto max-w-7xl px-6 py-16 grid gap-12 md:grid-cols-3">
        <div>
          <h3 className="font-display text-2xl text-gold mb-3">{contact.restaurant_name}</h3>
          <p className="text-sm text-muted-foreground flex items-start gap-2">
            <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              {contact.address_line1}<br />
              {contact.address_line2 && <>{contact.address_line2}<br /></>}
              {contact.postal_code} {contact.city}
            </span>
          </p>
        </div>
        <div className="text-sm space-y-2">
          <h4 className="uppercase tracking-widest text-xs text-gold mb-3">Kontakt</h4>
          {contact.phone && <p className="flex items-center gap-2"><Phone className="w-4 h-4" /> <a href={`tel:${contact.phone}`} className="hover:text-gold">{contact.phone}</a></p>}
          {contact.email && <p className="flex items-center gap-2"><Mail className="w-4 h-4" /> <a href={`mailto:${contact.email}`} className="hover:text-gold">{contact.email}</a></p>}
          <div className="flex gap-3 pt-2">
            {contact.instagram_url && <a href={contact.instagram_url} target="_blank" rel="noopener noreferrer" aria-label="Instagram"><Instagram className="w-5 h-5 hover:text-gold" /></a>}
            {contact.facebook_url && <a href={contact.facebook_url} target="_blank" rel="noopener noreferrer" aria-label="Facebook"><Facebook className="w-5 h-5 hover:text-gold" /></a>}
          </div>
        </div>
        <div className="text-sm">
          <h4 className="uppercase tracking-widest text-xs text-gold mb-3">Öffnungszeiten</h4>
          <ul className="space-y-1">
            {hours.map((h) => (
              <li key={h.weekday} className="flex justify-between gap-4">
                <span className="text-muted-foreground">{h.label}</span>
                <span>{h.is_closed ? "geschlossen" : `${h.open_time} – ${h.close_time}`}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto max-w-7xl px-6 py-5 flex flex-col sm:flex-row justify-between gap-2 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} {contact.restaurant_name}. Alle Rechte vorbehalten.</p>
          <Link to="/admin" className="hover:text-gold">Admin</Link>
        </div>
      </div>
    </footer>
  );
}
