import { useEffect, useState } from "react";

export interface HeroSliderProps {
  images: string[];
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export function HeroSlider({ images, eyebrow, title, subtitle, children }: HeroSliderProps) {
  const slides = images.length > 0 ? images : ["https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1920&q=80"];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), 6000);
    return () => clearInterval(t);
  }, [slides.length]);

  return (
    <section className="relative min-h-[100svh] w-full overflow-hidden">
      {/* Slides */}
      {slides.map((src, i) => (
        <div
          key={src + i}
          className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000"
          style={{ backgroundImage: `url(${src})`, opacity: i === index ? 1 : 0 }}
          aria-hidden={i !== index}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/45 to-black/85" />

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 pt-28 sm:pt-32 pb-10 min-h-[100svh] flex flex-col lg:grid lg:grid-cols-[1.2fr_minmax(320px,440px)] gap-8 lg:gap-12 items-center">
        <div className="text-center lg:text-left max-w-2xl">
          {eyebrow && <p className="text-gold tracking-[0.3em] uppercase text-xs sm:text-sm mb-4">{eyebrow}</p>}
          {title && <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-[1.05] mb-5">{title}</h1>}
          {subtitle && <p className="text-base sm:text-lg text-foreground/85 max-w-xl mx-auto lg:mx-0">{subtitle}</p>}
        </div>
        <div className="w-full max-w-md lg:max-w-none">{children}</div>
      </div>

      {/* Dots */}
      {slides.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Slide ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all ${i === index ? "w-6 bg-gold" : "w-2 bg-white/40"}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
