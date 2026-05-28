import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Loader2, ShoppingBag, Truck, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { fetchProductByHandleForStore } from "@/lib/catalog";
import { useCartStore } from "@/stores/cartStore";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/product/$handle")({
  loader: async ({ params }) => {
    const product = await fetchProductByHandleForStore(params.handle);
    if (!product) throw notFound();
    return {
      product,
      title: product.node.title,
      description:
        product.node.description?.slice(0, 160) ??
        `Produto Bessa's Box: ${params.handle}`,
    };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.title ?? "Produto"} — Bessa's Box` },
      { name: "description", content: loaderData?.description ?? "" },
    ],
  }),
  component: ProductPage,
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="text-center space-y-4">
        <h1 className="font-display text-4xl">Produto não encontrado</h1>
        <Link to="/" className="text-gold underline">
          Voltar para a loja
        </Link>
      </div>
    </div>
  ),
});

function ProductPage() {
  const { product } = Route.useLoaderData();
  const addItem = useCartStore((s) => s.addItem);
  const isLoading = useCartStore((s) => s.isLoading);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const variants = product.node.variants.edges;
  const selectedVariant =
    variants.find((v) => v.node.id === selectedVariantId)?.node ?? variants[0]?.node;
  const images = product.node.images.edges;
  const activeImage = images[selectedImageIndex]?.node ?? images[0]?.node;
  const thumbnails = images.slice(0, 6);

  const handleAdd = async () => {
    if (!selectedVariant) return;
    const result = await addItem({
      product,
      variantId: selectedVariant.id,
      variantTitle: selectedVariant.title,
      price: selectedVariant.price,
      quantity: 1,
      quantityAvailable: selectedVariant.quantityAvailable ?? null,
      selectedOptions: selectedVariant.selectedOptions || [],
    });
    if (result.ok) {
      toast.success("Adicionado à sacola", { position: "top-center" });
    } else {
      toast.error(result.message, { position: "top-center" });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground bg-mesh-dark">
      <SiteHeader homeOnlyNav={false} />

      <main className="pt-20 pb-0 max-w-7xl mx-auto px-4 sm:px-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-gold mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Voltar à loja
        </Link>

        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 pb-20">
          <div className="space-y-4">
            <div className="aspect-square premium-card rounded-xl overflow-hidden glow-gold">
              {activeImage && (
                <img
                  src={activeImage.url}
                  alt={activeImage.altText ?? product.node.title}
                  className="w-full h-full object-cover animate-fade-in"
                  key={activeImage.url}
                />
              )}
            </div>
            {thumbnails.length > 1 && (
              <div className="grid grid-cols-5 sm:grid-cols-6 gap-2" role="list" aria-label="Miniaturas do produto">
                {thumbnails.map((img, index) => (
                  <button
                    key={img.node.url}
                    type="button"
                    role="listitem"
                    onClick={() => setSelectedImageIndex(index)}
                    aria-label={`Ver imagem ${index + 1} de ${product.node.title}`}
                    aria-current={selectedImageIndex === index ? "true" : undefined}
                    className={cn(
                      "aspect-square rounded-lg overflow-hidden border-2 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
                      selectedImageIndex === index
                        ? "border-gold ring-2 ring-gold/20 scale-[1.02]"
                        : "border-border/60 hover:border-gold/50 opacity-80 hover:opacity-100",
                    )}
                  >
                    <img
                      src={img.node.url}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="lg:py-4 space-y-8 animate-fade-in-up">
            <div className="space-y-4">
              <p className="text-gold text-xs tracking-[0.25em] uppercase">Bessa's Box</p>
              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl normal-case leading-tight">
                {product.node.title}
              </h1>
              <p className="text-3xl sm:text-4xl text-gold font-bold tracking-tight">
                {selectedVariant?.price.currencyCode}{" "}
                {parseFloat(selectedVariant?.price.amount ?? "0").toFixed(2)}
              </p>
            </div>

            <div className="flex flex-wrap gap-4 py-4 border-y border-gold/15">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Truck className="w-4 h-4 text-gold shrink-0" aria-hidden="true" />
                Entrega para todo o Brasil
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ShieldCheck className="w-4 h-4 text-gold shrink-0" aria-hidden="true" />
                100% original
              </div>
            </div>

            {product.node.description && (
              <p className="text-muted-foreground whitespace-pre-line leading-relaxed">
                {product.node.description}
              </p>
            )}

            {variants.length > 1 && (
              <div className="space-y-3">
                <p className="text-sm tracking-[0.15em] uppercase font-medium" id="variant-label">
                  Variação
                </p>
                <div className="flex flex-wrap gap-2" role="group" aria-labelledby="variant-label">
                  {variants.map(({ node: v }) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariantId(v.id)}
                      disabled={!v.availableForSale}
                      aria-pressed={selectedVariant?.id === v.id}
                      className={cn(
                        "px-5 py-2.5 border rounded-lg text-sm transition-all duration-200",
                        selectedVariant?.id === v.id
                          ? "border-gold bg-gold/10 text-gold shadow-gold"
                          : "border-border hover:border-gold/60 hover:bg-gold/5",
                        !v.availableForSale && "opacity-40 line-through",
                      )}
                    >
                      {v.title}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3 pt-2">
              <Button
                onClick={handleAdd}
                disabled={isLoading || !selectedVariant?.availableForSale}
                size="lg"
                className="w-full bg-gold text-onyx hover:bg-gold-soft font-medium tracking-wide h-14 text-base shadow-gold"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                ) : (
                  <>
                    <ShoppingBag className="w-5 h-5 mr-2" aria-hidden="true" /> Adicionar à Sacola
                  </>
                )}
              </Button>
              {!selectedVariant?.availableForSale && (
                <p className="text-sm text-muted-foreground text-center">Produto esgotado nesta variação.</p>
              )}
              {selectedVariant?.availableForSale &&
                selectedVariant.quantityAvailable != null &&
                selectedVariant.quantityAvailable <= 10 && (
                  <p className="text-sm text-gold/80 text-center tracking-wide">
                    {selectedVariant.quantityAvailable === 1
                      ? "Última unidade em estoque"
                      : `${selectedVariant.quantityAvailable} unidades em estoque`}
                  </p>
                )}
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
