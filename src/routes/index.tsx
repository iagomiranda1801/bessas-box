import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { SectionAnchor } from "@/components/SectionAnchor";
import { Gem, Truck, ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { HeroSlider, type HeroSlide } from "@/components/HeroSlider";
import heroVerm from "@/assets/verm.jpeg";
import heroPreto from "@/assets/preto.jpeg";
import heroBessa from "@/assets/bessa-hero.jpg";

const HERO_SLIDES: HeroSlide[] = [
  {
    id: "colecao",
    image: heroVerm,
    imageAlt: "Peça em destaque vermelha",
    badge: "Nova coleção",
    badgeIcon: "gem",
    title: (
      <>
        <span className="text-foreground">Elegância casual</span>
        <br />
        <span className="text-gradient-gold">em cada detalhe</span>
      </>
    ),
    subtitle:
      "Tênis, camisetas e polos com corte impecável. Curadoria Bessa's Box para quem valoriza conforto e presença.",
    primaryCta: { label: "Ver coleção", href: "/colecao" },
    secondaryCta: { label: "A marca", href: "#marca" },
  },
  {
    id: "curadoria",
    image: heroPreto,
    imageAlt: "Peça em destaque preta",
    badge: "Curadoria premium",
    badgeIcon: "shield",
    title: (
      <>
        <span className="text-foreground">Peças</span>
        <br />
        <span className="text-gradient-gold">selecionadas à mão</span>
      </>
    ),
    subtitle: "Quantidades limitadas. Cada modelo passa pelo olhar da casa antes de chegar até você.",
    primaryCta: { label: "Ver destaques", href: "/destaques" },
    secondaryCta: { label: "Explorar tudo", href: "/colecao" },
  },
  {
    id: "entrega",
    image: heroBessa,
    imageAlt: "Bessa's Box",
    badge: "Entrega nacional",
    badgeIcon: "truck",
    title: (
      <>
        <span className="text-foreground">Do nosso box</span>
        <br />
        <span className="text-gradient-gold">para todo o Brasil</span>
      </>
    ),
    subtitle: "Compre com segurança. Originalidade garantida e envio para onde você estiver.",
    primaryCta: { label: "Comprar agora", href: "/colecao" },
  },
];

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Bessa's Box — Tênis, Camisetas & Polos Premium" },
      {
        name: "description",
        content:
          "Moda premium casual: tênis, camisetas e polos selecionados. Curadoria Bessa's Box com entrega para todo o Brasil.",
      },
      { property: "og:title", content: "Bessa's Box — Tênis, Camisetas & Polos Premium" },
      {
        property: "og:description",
        content: "Elegância casual. Tênis, camisetas e polos premium.",
      },
      { property: "og:image", content: heroVerm },
      { name: "twitter:image", content: heroVerm },
    ],
  }),
});

function Index() {
  useEffect(() => {
    const scrollToHash = () => {
      const hash = window.location.hash;
      if (!hash) return;
      const el = document.querySelector(hash);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    scrollToHash();
    window.addEventListener("hashchange", scrollToHash);
    return () => window.removeEventListener("hashchange", scrollToHash);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#conteudo-principal"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-gold focus:text-onyx focus:rounded-md focus:font-semibold"
      >
        Ir para o conteúdo
      </a>

      <SiteHeader />

      <main id="conteudo-principal">
        <HeroSlider slides={HERO_SLIDES} />

        <section className="border-y border-gold/20 bg-card/30 backdrop-blur-sm" aria-label="Benefícios da loja">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              { icon: Truck, title: "Entrega Brasil", desc: "Para todo o país" },
              { icon: ShieldCheck, title: "100% Original", desc: "Garantia da casa" },
              { icon: Gem, title: "Coleção Selecionada", desc: "Edição limitada" },
            ].map((f, i) => (
              <div
                key={f.title}
                className="flex items-center gap-4 animate-fade-in-up"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div
                  className="w-12 h-12 rounded-full border border-gold/40 flex items-center justify-center text-gold bg-gold/5"
                  aria-hidden="true"
                >
                  <f.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium tracking-wide">{f.title}</p>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="py-16 sm:py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="grid sm:grid-cols-2 gap-4">
              <Link
                to="/destaques"
                className="group premium-card rounded-xl p-8 sm:p-10 flex flex-col justify-between min-h-[200px] animate-fade-in-up"
              >
                <div className="space-y-2">
                  <p className="text-gold text-xs tracking-[0.25em] uppercase">Curadoria</p>
                  <h2 className="font-display text-3xl sm:text-4xl">Destaques</h2>
                  <p className="text-muted-foreground text-sm max-w-xs">
                    A seleção da casa — peças em evidência com estoque limitado.
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 text-gold text-sm font-medium mt-6 group-hover:gap-3 transition-all">
                  Explorar <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </span>
              </Link>

              <Link
                to="/colecao"
                className="group premium-card rounded-xl p-8 sm:p-10 flex flex-col justify-between min-h-[200px] animate-fade-in-up"
                style={{ animationDelay: "100ms" }}
              >
                <div className="space-y-2">
                  <p className="text-gold text-xs tracking-[0.25em] uppercase">Catálogo</p>
                  <h2 className="font-display text-3xl sm:text-4xl">Coleção</h2>
                  <p className="text-muted-foreground text-sm max-w-xs">
                    Todos os produtos disponíveis para compra.
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 text-gold text-sm font-medium mt-6 group-hover:gap-3 transition-all">
                  Ver tudo <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </span>
              </Link>
            </div>
          </div>
        </section>

        <section className="py-24 sm:py-32 relative overflow-hidden">
          <SectionAnchor id="marca" />
          <div className="absolute inset-0 bg-gold-radial-strong opacity-60" aria-hidden="true" />
          <div className="relative max-w-5xl mx-auto px-4 sm:px-6 text-center space-y-8">
            <p className="text-gold text-xs tracking-[0.25em] uppercase">A marca</p>
            <h2 className="font-display text-4xl sm:text-6xl md:text-7xl leading-tight">
              <span className="text-gradient-gold">Bessa's Box</span>
              <br />
              <span className="text-foreground text-3xl sm:text-5xl">é estilo atemporal</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Moda premium casual para o dia a dia exigente: conforto, caimento perfeito e presença
              discreta. Tênis, camisetas e polos com a mesma linguagem de elegância.
            </p>
            <div className="flex flex-wrap justify-center gap-4 pt-4">
              <Button asChild size="lg" className="bg-gold text-onyx hover:bg-gold-soft font-medium tracking-wide">
                <Link to="/destaques">Ver destaques</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-gold/50 hover:bg-gold/10 font-medium tracking-wide"
              >
                <Link to="/colecao">Ver coleção</Link>
              </Button>
            </div>
          </div>
        </section>

        <SiteFooter />
      </main>
    </div>
  );
}
