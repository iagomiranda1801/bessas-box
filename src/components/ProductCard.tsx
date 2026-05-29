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
import { Loader2, Plus, Sparkles } from "lucide-react";
import { addProductToSupabaseCart } from "@/lib/supabase-cart";
import type { ShopifyProduct } from "@/lib/shopify";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ProductCardProps = {
  product: ShopifyProduct;
  featured?: boolean;
  className?: string;
};

export function ProductCard({ product, featured = false, className }: ProductCardProps) {
  const [addingVariantId, setAddingVariantId] = useState<string | null>(null);
  const variants = product.node.variants.edges.map((e) => e.node);
  const variantIds = variants.map((v) => v.id);
  const isAddingThisProduct =
    addingVariantId != null && variantIds.includes(addingVariantId);
  const singleVariant = variants.length === 1 ? variants[0] : null;
  const image = product.node.images.edges[0]?.node;
  const price = product.node.priceRange.minVariantPrice;
  const hasMultipleVariants = variants.length > 1;
  const lowStock =
    singleVariant?.quantityAvailable != null &&
    singleVariant.quantityAvailable > 0 &&
    singleVariant.quantityAvailable <= 5;

  const [variantDialogOpen, setVariantDialogOpen] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  const addVariantToCart = async (variant: (typeof variants)[0]) => {
    if (!variant.availableForSale) {
      toast.error("Esta variação está esgotada");
      return;
    }

    setAddingVariantId(variant.id);
    try {
      const result = addProductToSupabaseCart(product, variant);
      if (result.ok) {
        toast.success("Adicionado à sacola", { position: "top-center" });
        setVariantDialogOpen(false);
      } else {
        toast.error(result.message ?? "Erro ao adicionar", { position: "top-center" });
      }
    } finally {
      setAddingVariantId(null);
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
      <article
        className={cn(
          "group premium-card rounded-lg overflow-hidden",
          featured && "md:row-span-2",
          className,
        )}
      >
        <Link
          to="/product/$handle"
          params={{ handle: product.node.handle }}
          className="block"
        >
          <div
            className={cn(
              "bg-secondary/30 overflow-hidden relative",
              featured ? "aspect-[4/5]" : "aspect-square",
            )}
          >
            {featured && (
              <span className="absolute top-3 left-3 z-10 inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase tracking-widest bg-gold/90 text-onyx rounded-sm font-medium">
                <Sparkles className="w-3 h-3" aria-hidden="true" />
                Destaque
              </span>
            )}
            {lowStock && !featured && (
              <span className="absolute top-3 left-3 z-10 px-2 py-0.5 text-[10px] uppercase tracking-widest border border-gold/50 text-gold rounded-sm bg-background/80 backdrop-blur-sm">
                Poucas unidades
              </span>
            )}
            {image ? (
              <img
                src={image.url}
                alt={image.altText ?? product.node.title}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                Sem imagem
              </div>
            )}
            <div
              className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              aria-hidden="true"
            />
          </div>
          <div className={cn("p-4 pb-2", featured && "p-5 pb-3")}>
            <h3
              className={cn(
                "font-display tracking-wide truncate normal-case text-foreground",
                featured ? "text-2xl sm:text-3xl" : "text-lg",
              )}
            >
              {product.node.title}
            </h3>
          </div>
        </Link>
        <div className={cn("px-4 pb-4 flex items-center justify-between gap-2", featured && "px-5 pb-5")}>
          <div>
            <p className={cn("text-gold font-bold", featured ? "text-2xl" : "text-lg")}>
              {price.currencyCode} {parseFloat(price.amount).toFixed(2)}
            </p>
            {featured && (
              <p className="text-xs text-muted-foreground mt-0.5 tracking-wide">Curadoria Bessa's Box</p>
            )}
          </div>
          <Button
            size="icon"
            onClick={handleQuickAdd}
            disabled={
              isAddingThisProduct || (!hasMultipleVariants && !canQuickAddSingle)
            }
            className={cn(
              "shrink-0 bg-gold text-onyx hover:bg-gold-soft transition-transform group-hover:scale-105",
              featured ? "h-11 w-11" : "h-9 w-9",
            )}
            aria-label={
              hasMultipleVariants
                ? `Escolher variação e adicionar ${product.node.title} à sacola`
                : `Adicionar ${product.node.title} à sacola`
            }
          >
            {isAddingThisProduct ? (
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
          <Button
            onClick={() => selectedVariant && addVariantToCart(selectedVariant)}
            disabled={
              (pendingVariantId != null && pendingVariantId === selectedVariant?.id) ||
              !selectedVariant?.availableForSale
            }
            className="w-full bg-gold text-onyx hover:bg-gold-soft font-medium tracking-wide"
          >
            {pendingVariantId === selectedVariant?.id ? (
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
