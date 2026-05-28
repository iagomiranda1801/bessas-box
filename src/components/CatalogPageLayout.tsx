import { Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ProductCard } from "@/components/ProductCard";
import type { ShopifyProduct } from "@/lib/shopify";

type CatalogPageLayoutProps = {
  eyebrow: string;
  title: string;
  description: string;
  products: ShopifyProduct[];
  emptyMessage?: string;
  variant?: "featured" | "grid";
  secondaryLink?: { label: string; to: string };
};

export function CatalogPageLayout({
  eyebrow,
  title,
  description,
  products,
  emptyMessage = "Em breve, novas peças.",
  variant = "grid",
  secondaryLink,
}: CatalogPageLayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground bg-mesh-dark">
      <SiteHeader homeOnlyNav={false} />

      <main className="pt-20 pb-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="max-w-2xl space-y-4 animate-fade-in-up">
            <p className="text-gold text-xs tracking-[0.25em] uppercase">{eyebrow}</p>
            <h1 className="font-display text-4xl sm:text-6xl leading-tight">{title}</h1>
            <p className="text-muted-foreground text-lg leading-relaxed">{description}</p>
            {secondaryLink && (
              <Link
                to={secondaryLink.to}
                className="inline-block text-sm text-gold hover:text-gold-soft transition-colors tracking-wide"
              >
                {secondaryLink.label} →
              </Link>
            )}
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-20 sm:pb-28">
          {products.length === 0 ? (
            <div className="border border-dashed border-gold/30 rounded-lg p-12 text-center premium-card">
              <p className="font-display text-2xl mb-2">{emptyMessage}</p>
              <p className="text-muted-foreground text-sm">
                Estamos preparando a coleção. Volte em instantes.
              </p>
            </div>
          ) : variant === "featured" ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-fr">
              {products.map((p, i) => (
                <ProductCard
                  key={p.node.id}
                  product={p}
                  featured={i === 0}
                  className={i === 0 ? "col-span-2 row-span-2" : undefined}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((p) => (
                <ProductCard key={p.node.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
