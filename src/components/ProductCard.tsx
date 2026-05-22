import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Plus } from "lucide-react";
import { useCartStore } from "@/stores/cartStore";
import type { ShopifyProduct } from "@/lib/shopify";
import { toast } from "sonner";

export function ProductCard({ product }: { product: ShopifyProduct }) {
  const addItem = useCartStore((state) => state.addItem);
  const isLoading = useCartStore((state) => state.isLoading);
  const variants = product.node.variants.edges.map((e) => e.node);
  const singleVariant = variants.length === 1 ? variants[0] : null;
  const image = product.node.images.edges[0]?.node;
  const price = product.node.priceRange.minVariantPrice;
  const hasMultipleVariants = variants.length > 1;

  const [variantDialogOpen, setVariantDialogOpen] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  const addVariantToCart = async (variant: (typeof variants)[0]) => {
    if (!variant.availableForSale) {
      toast.error("Esta variação está esgotada");
      return;
    }
    const result = await addItem({
      product,
      variantId: variant.id,
      variantTitle: variant.title,
      price: variant.price,
      quantity: 1,
      quantityAvailable: variant.quantityAvailable ?? null,
      selectedOptions: variant.selectedOptions || [],
    });
    if (result.ok) {
      toast.success("Adicionado à sacola", { position: "top-center" });
      setVariantDialogOpen(false);
    } else {
      toast.error(result.message, { position: "top-center" });
    }
  };

  const handleQuickAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (hasMultipleVariants) {
      setSelectedVariantId(variants.find((v) => v.availableForSale)?.id ?? variants[0]?.id ?? null);
      setVariantDialogOpen(true);
      return;
    }

    if (!singleVariant) return;
    await addVariantToCart(singleVariant);
  };

  const selectedVariant = variants.find((v) => v.id === selectedVariantId) ?? variants[0];
  const canQuickAddSingle = singleVariant?.availableForSale ?? false;

  return (
    <>
      <article className="group border border-border bg-card rounded-md overflow-hidden hover:border-gold/60 transition-colors">
        <Link
          to="/product/$handle"
          params={{ handle: product.node.handle }}
          className="block"
        >
          <div className="aspect-square bg-secondary/40 overflow-hidden relative">
            {image ? (
              <img
                src={image.url}
                alt={image.altText ?? product.node.title}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                Sem imagem
              </div>
            )}
          </div>
          <div className="p-4 pb-2">
            <h3 className="font-display text-lg tracking-wide truncate normal-case">
              {product.node.title}
            </h3>
          </div>
        </Link>
        <div className="px-4 pb-4 flex items-center justify-between gap-2">
          <p className="text-gold font-bold text-lg">
            {price.currencyCode} {parseFloat(price.amount).toFixed(2)}
          </p>
          <Button
            size="icon"
            onClick={handleQuickAdd}
            disabled={isLoading || (!hasMultipleVariants && !canQuickAddSingle)}
            className="h-9 w-9 bg-gold text-onyx hover:bg-gold-soft shrink-0"
            aria-label={
              hasMultipleVariants
                ? `Escolher variação e adicionar ${product.node.title} à sacola`
                : `Adicionar ${product.node.title} à sacola`
            }
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Plus className="w-4 h-4" aria-hidden="true" />
            )}
          </Button>
        </div>
      </article>

      <Dialog open={variantDialogOpen} onOpenChange={setVariantDialogOpen}>
        <DialogContent className="bg-background border-gold/30 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl normal-case">
              {product.node.title}
            </DialogTitle>
            <DialogDescription>Selecione a variação para adicionar à sacola</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2 py-2">
            {variants.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelectedVariantId(v.id)}
                disabled={!v.availableForSale}
                className={`px-4 py-2 border rounded-md text-sm transition-colors ${
                  selectedVariant?.id === v.id
                    ? "border-gold bg-gold/10 text-gold"
                    : "border-border hover:border-gold/60"
                } ${!v.availableForSale ? "opacity-40 line-through" : ""}`}
              >
                {v.title}
              </button>
            ))}
          </div>
          <Button
            onClick={() => selectedVariant && addVariantToCart(selectedVariant)}
            disabled={isLoading || !selectedVariant?.availableForSale}
            className="w-full bg-gold text-onyx hover:bg-gold-soft font-medium tracking-wide"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              "Adicionar à Sacola"
            )}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
