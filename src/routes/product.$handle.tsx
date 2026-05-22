import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Loader2, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { fetchProductByHandle } from "@/lib/shopify";
import { useCartStore } from "@/stores/cartStore";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/product/$handle")({
  loader: async ({ params, context }) => {
    const product = await context.queryClient.ensureQueryData({
      queryKey: ["product", params.handle],
      queryFn: () => fetchProductByHandle(params.handle),
    });
    return {
      title: product?.node.title ?? params.handle,
      description: product?.node.description?.slice(0, 160) ?? `Produto Bessa's Box: ${params.handle}`,
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
  const { handle } = Route.useParams();
  const addItem = useCartStore((s) => s.addItem);
  const isLoading = useCartStore((s) => s.isLoading);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const { data: product, isLoading: loading, isError } = useQuery({
    queryKey: ["product", handle],
    queryFn: () => fetchProductByHandle(handle),
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-gold" aria-label="Carregando produto" />
      </div>
    );
  }

  if (isError || !product) throw notFound();

  const variants = product.node.variants.edges;
  const selectedVariant =
    variants.find((v) => v.node.id === selectedVariantId)?.node ?? variants[0]?.node;
  const images = product.node.images.edges;
  const activeImage = images[selectedImageIndex]?.node ?? images[0]?.node;
  const thumbnails = images.slice(0, 5);

  const handleAdd = async () => {
    if (!selectedVariant) return;
    const result = await addItem({
      product,
      variantId: selectedVariant.id,
      variantTitle: selectedVariant.title,
      price: selectedVariant.price,
      quantity: 1,
      selectedOptions: selectedVariant.selectedOptions || [],
    });
    if (result.ok) {
      toast.success("Adicionado à sacola", { position: "top-center" });
    } else {
      toast.error(result.message, { position: "top-center" });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader homeOnlyNav={false} />

      <main className="pt-24 pb-20 max-w-7xl mx-auto px-4 sm:px-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-gold mb-8"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Voltar
        </Link>

        <div className="grid md:grid-cols-2 gap-10">
          <div className="space-y-3">
            <div className="aspect-square bg-card rounded-md overflow-hidden border border-border">
              {activeImage && (
                <img
                  src={activeImage.url}
                  alt={activeImage.altText ?? product.node.title}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            {thumbnails.length > 1 && (
              <div className="grid grid-cols-4 gap-2" role="list" aria-label="Miniaturas do produto">
                {thumbnails.map((img, index) => (
                  <button
                    key={img.node.url}
                    type="button"
                    role="listitem"
                    onClick={() => setSelectedImageIndex(index)}
                    aria-label={`Ver imagem ${index + 1} de ${product.node.title}`}
                    aria-current={selectedImageIndex === index ? "true" : undefined}
                    className={cn(
                      "aspect-square bg-card rounded-md overflow-hidden border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      selectedImageIndex === index
                        ? "border-gold ring-2 ring-gold/30"
                        : "border-border hover:border-gold/60",
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

          <div className="space-y-6">
            <div>
              <h1 className="font-display text-4xl sm:text-5xl normal-case">{product.node.title}</h1>
              <p className="text-3xl text-gold font-bold mt-3">
                {selectedVariant?.price.currencyCode}{" "}
                {parseFloat(selectedVariant?.price.amount ?? "0").toFixed(2)}
              </p>
            </div>

            {product.node.description && (
              <p className="text-muted-foreground whitespace-pre-line">{product.node.description}</p>
            )}

            {variants.length > 1 && (
              <div className="space-y-2">
                <p className="text-sm tracking-wide font-medium" id="variant-label">
                  Selecione a variação
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
                        "px-4 py-2 border rounded-md text-sm transition-colors",
                        selectedVariant?.id === v.id
                          ? "border-gold bg-gold/10 text-gold"
                          : "border-border hover:border-gold/60",
                        !v.availableForSale && "opacity-40 line-through",
                      )}
                    >
                      {v.title}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button
              onClick={handleAdd}
              disabled={isLoading || !selectedVariant?.availableForSale}
              size="lg"
              className="w-full sm:w-auto bg-gold text-onyx hover:bg-gold-soft font-medium tracking-wide"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <>
                  <ShoppingBag className="w-4 h-4 mr-2" aria-hidden="true" /> Adicionar à Sacola
                </>
              )}
            </Button>
            {!selectedVariant?.availableForSale && (
              <p className="text-sm text-muted-foreground">Produto esgotado nesta variação.</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
