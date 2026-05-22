import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Gem, Truck, ShieldCheck, Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { ProductCard } from "@/components/ProductCard";
import { fetchProducts } from "@/lib/shopify";
import logo from "@/assets/bessa-logo.png";
import heroImg from "@/assets/verm.jpeg";

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
      { property: "og:image", content: heroImg },
      { name: "twitter:image", content: heroImg },
    ],
  }),
});

function Index() {
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => fetchProducts(24),
  });

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
        {/* HERO */}
        <section className="relative pt-16 min-h-[85svh] flex items-center overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
            <img
              src={heroImg}
              alt=""
              className="h-full max-h-[min(85svh,720px)] w-auto max-w-full object-contain opacity-45"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />
            <div className="absolute inset-0 bg-gold-radial" />
          </div>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-20 w-full">
            <div className="max-w-2xl space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 border border-gold/40 rounded-full text-xs tracking-wide text-gold">
                <Gem className="w-3 h-3" aria-hidden="true" /> Nova coleção
              </div>
              <h1 className="font-display text-5xl sm:text-7xl md:text-8xl leading-[1.05]">
                <span className="text-foreground">Elegância casual</span>
                <br />
                <span className="text-gradient-gold">em cada detalhe</span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-lg">
                Tênis, camisetas e polos com corte impecável e acabamento premium. Curadoria
                Bessa's Box para quem valoriza conforto e presença.
              </p>
              <p className="text-sm text-gold/80 tracking-wide">Tênis · Camisetas · Polos</p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Button
                  asChild
                  size="lg"
                  className="bg-gold text-onyx hover:bg-gold-soft font-medium tracking-wide"
                >
                  <a href="#colecao">Ver coleção</a>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-gold/50 text-foreground hover:bg-gold/10 font-medium tracking-wide"
                >
                  <a href="#marca">A marca</a>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* TRUST BAR */}
        <section className="border-y border-gold/20 bg-card/30" aria-label="Benefícios da loja">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { icon: Truck, title: "Entrega Brasil", desc: "Para todo o país" },
              { icon: ShieldCheck, title: "100% Original", desc: "Garantia da casa" },
              { icon: Gem, title: "Coleção Selecionada", desc: "Peças em quantidade limitada" },
            ].map((f) => (
              <div key={f.title} className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full border border-gold/40 flex items-center justify-center text-gold"
                  aria-hidden="true"
                >
                  <f.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium tracking-wide text-sm">{f.title}</p>
                  <p className="text-xs text-muted-foreground">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* COLEÇÃO */}
        <section id="colecao" className="py-20 sm:py-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex items-end justify-between mb-10 gap-4">
              <div>
                <p className="text-gold text-xs tracking-wide mb-2">Catálogo</p>
                <h2 className="font-display text-4xl sm:text-5xl">A coleção</h2>
              </div>
              <p className="hidden sm:block text-sm text-muted-foreground max-w-sm text-right">
                Cada peça passa por curadoria da casa. Quantidades limitadas por modelo.
              </p>
            </div>

            {isLoading ? (
              <div
                className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
                aria-busy="true"
                aria-label="Carregando produtos"
              >
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="aspect-square bg-card animate-pulse rounded-md" />
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="border border-dashed border-gold/30 rounded-md p-12 text-center">
                <p className="font-display text-2xl mb-2">Nenhum produto encontrado</p>
                <p className="text-muted-foreground text-sm max-w-md mx-auto">
                  Sua loja ainda não tem produtos cadastrados. Volte em breve para conferir as
                  próximas peças da coleção.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {products.map((p) => (
                  <ProductCard key={p.node.id} product={p} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* MARCA */}
        <section id="marca" className="py-20 sm:py-28 bg-card/30 border-y border-gold/20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center space-y-6">
            <p className="text-gold text-xs tracking-wide">A marca</p>
            <h2 className="font-display text-4xl sm:text-6xl">
              <span className="text-gradient-gold">Bessa's Box</span> é estilo atemporal.
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Moda premium casual para o dia a dia exigente: conforto, caimento perfeito e
              presença discreta. Cada peça é escolhida para combinar tênis, camisetas e polos com
              a mesma linguagem de elegância.
            </p>
          </div>
        </section>

        {/* CONTATO / FOOTER */}
        <footer id="contato" className="py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="space-y-4">
              <img src={logo} alt="Bessa's Box" className="h-12 w-auto" />
              <p className="text-sm text-muted-foreground max-w-xs">
                Tênis, camisetas e polos. Moda premium com entrega para todo o Brasil.
              </p>
            </div>
            <div className="space-y-3">
              <p className="font-display text-lg">Navegação</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#colecao" className="hover:text-gold">
                    Coleção
                  </a>
                </li>
                <li>
                  <a href="#marca" className="hover:text-gold">
                    A marca
                  </a>
                </li>
                <li>
                  <a href="#contato" className="hover:text-gold">
                    Contato
                  </a>
                </li>
              </ul>
            </div>
            <div className="space-y-3">
              <p className="font-display text-lg">Fale com a gente</p>
              <a
                href="https://www.instagram.com/bessasbox"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm hover:text-gold"
                aria-label="Instagram da Bessa's Box (abre em nova aba)"
              >
                <Instagram className="w-4 h-4" aria-hidden="true" /> @bessasbox
              </a>
            </div>
          </div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-10 pt-6 border-t border-gold/20 text-xs text-muted-foreground flex flex-col sm:flex-row sm:justify-between gap-2">
            <p>© {new Date().getFullYear()} Bessa's Box. Todos os direitos reservados.</p>
            <p className="text-gold/70">Premium casual</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
