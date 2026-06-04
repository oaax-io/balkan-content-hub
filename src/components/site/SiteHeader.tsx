import { Link } from "@tanstack/react-router";
import logo from "@/assets/logo.webp";

export function SiteHeader() {
  return (
    <header className="absolute top-0 left-0 right-0 z-30">
      <div className="mx-auto max-w-7xl px-6 py-5 flex items-center justify-between gap-6">
        <Link to="/" className="flex items-center gap-3">
          <img src={logo} alt="Balkaneros" className="h-12 w-auto" />
        </Link>
        <nav className="hidden md:flex items-center gap-6 lg:gap-8 text-sm tracking-widest uppercase">
          <Link to="/" activeOptions={{ exact: true }} className="hover:text-gold transition-colors" activeProps={{ className: "text-gold" }}>Home</Link>
          <Link to="/brunch" className="hover:text-gold transition-colors" activeProps={{ className: "text-gold" }}>Brunch</Link>
          <Link to="/dinner" className="hover:text-gold transition-colors" activeProps={{ className: "text-gold" }}>Dinner</Link>
          <Link to="/events" className="hover:text-gold transition-colors" activeProps={{ className: "text-gold" }}>Events</Link>
          <Link to="/ueber-uns" className="hover:text-gold transition-colors" activeProps={{ className: "text-gold" }}>Über uns</Link>
          <Link to="/kontakt" className="hover:text-gold transition-colors" activeProps={{ className: "text-gold" }}>Kontakt</Link>
        </nav>
        <Link
          to="/reservieren"
          className="hidden sm:inline-flex items-center rounded-full bg-gold px-5 py-2.5 text-sm font-medium uppercase tracking-widest text-gold-foreground hover:opacity-90 transition"
        >
          Reservieren
        </Link>
      </div>
    </header>
  );
}
