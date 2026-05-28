import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, ExternalLink, Handshake, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PARTNERS } from "@/lib/partners";

export const Route = createFileRoute("/parcerias")({
  component: ParceriasPage,
  head: () => ({
    meta: [
      { title: "Parcerias — Bessa's Box" },
      {
        name: "description",
        content:
          "Conheça as parcerias da Bessa's Box. Marcas selecionadas que compartilham o mesmo compromisso com estilo e qualidade.",
      },
    ],
  }),
});

function ParceriasPage() {
  return (
    <div className="min-h-screen bg-background text-foreground bg-mesh-dark">
      <SiteHeader homeOnlyNav={false} />

      <main className="pt-20 pb-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-gold mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Voltar à home
          </Link>

          <div className="max-w-3xl space-y-4 animate-fade-in-up">
            <p className="text-gold text-xs tracking-[0.25em] uppercase flex items-center gap-2">
              <Handshake className="w-4 h-4" aria-hidden="true" />
              Parcerias
            </p>
            <h1 className="font-display text-4xl sm:text-6xl leading-tight">
              Marcas que caminham com a{" "}
              <span className="text-gradient-gold">Bessa&apos;s Box</span>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Selecionamos parceiros que reforçam a mesma proposta: elegância casual, cuidado com
              detalhes e experiência premium para o cliente.
            </p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-20 sm:pb-28 space-y-8">
          {PARTNERS.map((partner) => (
            <article
              key={partner.id}
              className="partner-logo-frame rounded-2xl overflow-hidden animate-fade-in-up"
            >
              <div className="grid lg:grid-cols-[auto_1fr] gap-8 p-6 sm:p-10">
                <div className="flex justify-center lg:justify-start">
                  <img
                    src={partner.logo}
                    alt={partner.logoAlt}
                    className="w-40 h-40 sm:w-48 sm:h-48 rounded-xl object-cover shadow-gold"
                  />
                </div>

                <div className="space-y-6 text-center lg:text-left">
                  <div>
                    <p className="text-gold text-xs tracking-[0.25em] uppercase flex items-center justify-center lg:justify-start gap-2">
                      <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                      {partner.tagline}
                    </p>
                    <h2 className="font-display text-3xl sm:text-4xl mt-2">{partner.name}</h2>
                    <p className="text-muted-foreground mt-3 leading-relaxed max-w-xl mx-auto lg:mx-0">
                      {partner.description}
                    </p>
                  </div>

                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {partner.benefits.map((benefit) => (
                      <li key={benefit} className="flex items-start gap-2 justify-center lg:justify-start">
                        <span className="text-gold mt-1.5 shrink-0" aria-hidden="true">
                          ·
                        </span>
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="flex flex-wrap gap-3 justify-center lg:justify-start pt-2">
                    {partner.href ? (
                      <Button
                        asChild
                        className="bg-gold text-onyx hover:bg-gold-soft font-medium tracking-wide"
                      >
                        <a
                          href={partner.href}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Visitar {partner.name}
                          <ExternalLink className="w-4 h-4 ml-2" aria-hidden="true" />
                        </a>
                      </Button>
                    ) : null}
                    <Button
                      asChild
                      variant="outline"
                      className="border-gold/50 hover:bg-gold/10 font-medium tracking-wide"
                    >
                      <Link to="/colecao">
                        Ver coleção Bessa&apos;s Box
                        <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </article>
          ))}

          {PARTNERS.length === 0 && (
            <div className="premium-card rounded-xl p-12 text-center">
              <p className="font-display text-2xl">Em breve, novas parcerias</p>
            </div>
          )}
        </div>

        <section className="border-t border-gold/15 bg-card/20 py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
            <p className="text-muted-foreground text-center sm:text-left">
              Quer conhecer nossa curadoria de moda premium?
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Button asChild variant="outline" className="border-gold/50 hover:bg-gold/10">
                <Link to="/destaques">Destaques</Link>
              </Button>
              <Button asChild className="bg-gold text-onyx hover:bg-gold-soft">
                <Link to="/colecao">Coleção completa</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
