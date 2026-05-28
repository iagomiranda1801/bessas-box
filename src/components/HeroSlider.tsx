import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Gem, Truck, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function CtaLink({ href, children }: { href: string; children: React.ReactNode }) {
  if (href.startsWith("/")) {
    return <Link to={href}>{children}</Link>;
  }
  return <a href={href}>{children}</a>;
}

export type HeroSlide = {
  id: string;
  image: string;
  imageAlt: string;
  badge: string;
  badgeIcon?: "gem" | "truck" | "shield";
  title: React.ReactNode;
  subtitle: string;
  primaryCta: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
};

const BADGE_ICONS = {
  gem: Gem,
  truck: Truck,
  shield: ShieldCheck,
} as const;

const AUTOPLAY_MS = 6000;

type HeroSliderProps = {
  slides: HeroSlide[];
};

export function HeroSlider({ slides }: HeroSliderProps) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goTo = useCallback(
    (index: number) => {
      setActive((index + slides.length) % slides.length);
    },
    [slides.length],
  );

  const next = useCallback(() => goTo(active + 1), [active, goTo]);
  const prev = useCallback(() => goTo(active - 1), [active, goTo]);

  useEffect(() => {
    if (paused || slides.length <= 1) return;
    timerRef.current = setInterval(next, AUTOPLAY_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [paused, next, slides.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  const slide = slides[active];
  const BadgeIcon = slide ? BADGE_ICONS[slide.badgeIcon ?? "gem"] : Gem;

  return (
    <section
      className="relative pt-16 min-h-[90svh] flex items-center overflow-hidden bg-mesh-dark"
      aria-roledescription="carousel"
      aria-label="Destaques da coleção"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false);
      }}
    >
      {slides.map((s, i) => (
        <div
          key={s.id}
          className={cn(
            "absolute inset-0 flex items-center justify-center transition-opacity duration-1000 ease-out",
            i === active ? "opacity-100 z-0" : "opacity-0 z-0 pointer-events-none",
          )}
          aria-hidden={i !== active}
        >
          <img
            src={s.image}
            alt=""
            className="h-full max-h-[min(90svh,800px)] w-auto max-w-full object-contain opacity-50 sm:opacity-55"
          />
        </div>
      ))}

      <div
        className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/75 to-background z-[1]"
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-gold-radial-strong z-[1]" aria-hidden="true" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-20 w-full">
        {slide && (
          <div
            key={slide.id}
            className="max-w-2xl space-y-6 animate-fade-in-up"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-gold/40 rounded-full text-xs tracking-[0.2em] uppercase text-gold bg-background/40 backdrop-blur-sm">
              <BadgeIcon className="w-3 h-3" aria-hidden="true" />
              {slide.badge}
            </div>
            <h1 className="font-display text-5xl sm:text-7xl md:text-8xl leading-[1.05]">
              {slide.title}
            </h1>
            <p className="text-lg text-muted-foreground max-w-lg">{slide.subtitle}</p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                asChild
                size="lg"
                className="bg-gold text-onyx hover:bg-gold-soft font-medium tracking-wide shadow-gold"
              >
                <CtaLink href={slide.primaryCta.href}>{slide.primaryCta.label}</CtaLink>
              </Button>
              {slide.secondaryCta && (
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-gold/50 text-foreground hover:bg-gold/10 font-medium tracking-wide backdrop-blur-sm"
                >
                  <CtaLink href={slide.secondaryCta.href}>{slide.secondaryCta.label}</CtaLink>
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {slides.length > 1 && (
        <>
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex gap-2">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => goTo(i)}
                className={cn(
                  "h-2 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  i === active ? "w-8 bg-gold" : "w-2 bg-gold/40 hover:bg-gold/70",
                )}
                aria-label={`Ir para slide ${i + 1}: ${s.badge}`}
                aria-current={i === active ? "true" : undefined}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={prev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full border border-gold/30 bg-background/60 backdrop-blur-md flex items-center justify-center text-gold hover:bg-gold/10 hover:border-gold/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            aria-label="Slide anterior"
          >
            <ChevronLeft className="w-5 h-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={next}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full border border-gold/30 bg-background/60 backdrop-blur-md flex items-center justify-center text-gold hover:bg-gold/10 hover:border-gold/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            aria-label="Próximo slide"
          >
            <ChevronRight className="w-5 h-5" aria-hidden="true" />
          </button>
        </>
      )}
    </section>
  );
}
