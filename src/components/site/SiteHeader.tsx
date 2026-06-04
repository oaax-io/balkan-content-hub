import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Instagram, Facebook, Youtube } from "lucide-react";
import logo from "@/assets/logo.webp";

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        scrolled
          ? "bg-background/85 backdrop-blur-md border-b border-gold/20 shadow-lg"
          : "bg-transparent"
      }`}
    >
      <div
        className={`mx-auto max-w-7xl px-6 flex items-center justify-between gap-6 transition-all duration-300 ${
          scrolled ? "py-3" : "py-5"
        }`}
      >
        <Link to="/" className="flex items-center gap-3">
          <img
            src={logo}
            alt="Balkaneros"
            className={`w-auto transition-all duration-300 ${scrolled ? "h-9" : "h-12"}`}
          />
        </Link>
        <nav className="hidden md:flex items-center gap-6 lg:gap-8 text-sm tracking-widest uppercase">
          <Link to="/" activeOptions={{ exact: true }} className="hover:text-gold transition-colors" activeProps={{ className: "text-gold" }}>Home</Link>
          <Link to="/brunch" className="hover:text-gold transition-colors" activeProps={{ className: "text-gold" }}>Brunch</Link>
          <Link to="/dinner" className="hover:text-gold transition-colors" activeProps={{ className: "text-gold" }}>Dinner</Link>
          <Link to="/events" className="hover:text-gold transition-colors" activeProps={{ className: "text-gold" }}>Events</Link>
          <Link to="/ueber-uns" className="hover:text-gold transition-colors" activeProps={{ className: "text-gold" }}>Über uns</Link>
        </nav>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2">
            <a
              href="https://www.instagram.com/balkaneros.ch"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="p-2 rounded-full text-foreground/80 hover:text-gold hover:bg-gold/10 transition"
            >
              <Instagram size={18} />
            </a>
            <a
              href="https://www.facebook.com/balkaneros.ch"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
              className="p-2 rounded-full text-foreground/80 hover:text-gold hover:bg-gold/10 transition"
            >
              <Facebook size={18} />
            </a>
            <a
              href="https://www.youtube.com/@balkaneros"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="YouTube"
              className="p-2 rounded-full text-foreground/80 hover:text-gold hover:bg-gold/10 transition"
            >
              <Youtube size={18} />
            </a>
          </div>
          <Link
            to="/reservieren"
            className="hidden sm:inline-flex items-center rounded-full bg-gold px-5 py-2.5 text-sm font-medium uppercase tracking-widest text-gold-foreground hover:opacity-90 transition"
          >
            Reservieren
          </Link>
        </div>
      </div>
    </header>
  );
}
