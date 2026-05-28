import { Link } from "@tanstack/react-router";
import { ArrowRight, Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PARTNERS } from "@/lib/partners";

export function HomePartnersSection() {
  if (PARTNERS.length === 0) return null;

  const names = PARTNERS.map((p) => p.name).join(" · ");

  return (
    <section
      className="py-10 sm:py-14 border-b border-gold/15 relative overflow-hidden"
      aria-labelledby="home-parcerias-heading"
    >
      <div
        className="absolute inset-0 bg-gold-radial opacity-40 pointer-events-none"
        aria-hidden="true"
      />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        <div className="partner-logo-frame rounded-2xl p-6 sm:p-8 lg:p-10">
          <div className="flex flex-col lg:flex-row lg:items-center gap-8 lg:gap-10">
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 shrink-0">
              {PARTNERS.map((partner) => (
                <img
                  key={partner.id}
                  src={partner.logo}
                  alt={partner.logoAlt}
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl object-cover shadow-gold ring-2 ring-gold/30"
                />
              ))}
            </div>

            <div className="flex-1 text-center lg:text-left space-y-3">
              <p className="text-gold text-xs tracking-[0.25em] uppercase flex items-center justify-center lg:justify-start gap-2">
                <Handshake className="w-4 h-4" aria-hidden="true" />
                Parcerias em destaque
              </p>
              <h2
                id="home-parcerias-heading"
                className="font-display text-2xl sm:text-4xl leading-tight"
              >
                Bessa&apos;s Box +{" "}
                <span className="text-gradient-gold">marcas parceiras</span>
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                Moda premium e experiências selecionadas no mesmo ecossistema. Hoje com{" "}
                <span className="text-foreground/90">{names}</span> — estilo, presença e cuidado
                pessoal alinhados.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row lg:flex-col gap-3 justify-center lg:shrink-0">
              <Button
                asChild
                className="bg-gold text-onyx hover:bg-gold-soft font-medium tracking-wide"
              >
                <Link to="/parcerias">
                  Conhecer parcerias
                  <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="border-gold/40 hover:bg-gold/10 font-medium tracking-wide"
              >
                <Link to="/colecao">Ver coleção</Link>
              </Button>
            </div>
          </div>

          <ul className="mt-8 pt-6 border-t border-gold/15 grid sm:grid-cols-3 gap-4 text-center sm:text-left">
            {PARTNERS[0]?.benefits.map((benefit) => (
              <li key={benefit} className="text-sm text-muted-foreground flex gap-2 justify-center sm:justify-start">
                <span className="text-gold shrink-0" aria-hidden="true">
                  ·
                </span>
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
