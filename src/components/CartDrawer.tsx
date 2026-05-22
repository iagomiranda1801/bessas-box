import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ShoppingBag, Minus, Plus, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { useCartStore } from "@/stores/cartStore";
import { cartCheckoutFn } from "@/lib/cart.server";
import { CHECKOUT_PASSWORD_STORE_MESSAGE } from "@/lib/shopify-cart";
import { toast } from "sonner";

export const CartDrawer = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const { items, cartId, isLoading, isSyncing, updateQuantity, removeItem, syncCart } = useCartStore();
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + (parseFloat(item.price.amount) * item.quantity), 0);
  const currency = items[0]?.price.currencyCode ?? "BRL";

  useEffect(() => {
    if (isOpen) syncCart();
  }, [isOpen, syncCart]);

  const handleCheckout = async () => {
    if (!cartId) {
      toast.error("Sacola vazia ou expirada. Adicione um produto novamente.", {
        position: "top-center",
      });
      return;
    }

    setIsCheckoutLoading(true);
    try {
      const result = await cartCheckoutFn({ data: { cartId } });
      if (!result.ok) {
        toast.error(result.message, { position: "top-center", duration: 6000 });
        return;
      }

      useCartStore.setState({ checkoutUrl: result.checkoutUrl });
      window.open(result.checkoutUrl, "_blank", "noopener,noreferrer");
      setIsOpen(false);
      toast.info("Checkout aberto em nova aba", {
        position: "top-center",
        description: CHECKOUT_PASSWORD_STORE_MESSAGE,
        duration: 10000,
      });
    } catch {
      toast.error("Não foi possível abrir o checkout. Tente novamente.", {
        position: "top-center",
      });
    } finally {
      setIsCheckoutLoading(false);
    }
  };

  const handleUpdateQuantity = async (variantId: string, quantity: number) => {
    const ok = await updateQuantity(variantId, quantity);
    if (!ok) {
      toast.error("Não foi possível atualizar a quantidade.", { position: "top-center" });
    }
  };

  const handleRemove = async (variantId: string) => {
    const ok = await removeItem(variantId);
    if (!ok) {
      toast.error("Não foi possível remover o item.", { position: "top-center" });
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative border-gold bg-background/60 backdrop-blur hover:bg-gold/10"
          aria-label={totalItems > 0 ? `Sacola com ${totalItems} itens` : "Abrir sacola"}
        >
          <ShoppingBag className="h-5 w-5 text-gold" aria-hidden="true" />
          {totalItems > 0 && (
            <Badge
              className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs bg-gold text-onyx"
              aria-hidden="true"
            >
              {totalItems}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg flex flex-col h-full bg-background border-l border-gold/30">
        <SheetHeader className="flex-shrink-0">
          <SheetTitle className="font-display text-2xl">Sua sacola</SheetTitle>
          <SheetDescription>
            {totalItems === 0
              ? "Sua sacola está vazia"
              : `${totalItems} ite${totalItems !== 1 ? "ns" : "m"} na sua sacola`}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col flex-1 pt-6 min-h-0">
          {items.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-4" aria-hidden="true" />
                <p className="text-muted-foreground">Adicione produtos para começar</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto pr-2 min-h-0">
                <ul className="space-y-4">
                  {items.map((item) => (
                    <li
                      key={item.variantId}
                      className="flex gap-4 p-3 border border-border rounded-md bg-card/50"
                    >
                      <Link
                        to="/product/$handle"
                        params={{ handle: item.product.node.handle }}
                        onClick={() => setIsOpen(false)}
                        className="w-20 h-20 bg-secondary/40 rounded-md overflow-hidden flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {item.product.node.images?.edges?.[0]?.node && (
                          <img
                            src={item.product.node.images.edges[0].node.url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        )}
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link
                          to="/product/$handle"
                          params={{ handle: item.product.node.handle }}
                          onClick={() => setIsOpen(false)}
                          className="font-medium truncate block hover:text-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                        >
                          {item.product.node.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {item.selectedOptions.map((o) => o.value).join(" • ")}
                        </p>
                        <p className="font-semibold text-gold mt-1">
                          {currency} {parseFloat(item.price.amount).toFixed(2)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleRemove(item.variantId)}
                          aria-label={`Remover ${item.product.node.title} da sacola`}
                        >
                          <Trash2 className="h-3 w-3" aria-hidden="true" />
                        </Button>
                        <div className="flex items-center gap-1" role="group" aria-label={`Quantidade de ${item.product.node.title}`}>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleUpdateQuantity(item.variantId, item.quantity - 1)}
                            aria-label="Diminuir quantidade"
                          >
                            <Minus className="h-3 w-3" aria-hidden="true" />
                          </Button>
                          <span className="w-8 text-center text-sm" aria-live="polite">
                            {item.quantity}
                          </span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleUpdateQuantity(item.variantId, item.quantity + 1)}
                            aria-label="Aumentar quantidade"
                          >
                            <Plus className="h-3 w-3" aria-hidden="true" />
                          </Button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex-shrink-0 space-y-4 pt-4 border-t border-gold/20 bg-background">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-medium tracking-wide">Total</span>
                  <span className="text-2xl font-bold text-gold">
                    {currency} {totalPrice.toFixed(2)}
                  </span>
                </div>
                <Button
                  onClick={handleCheckout}
                  className="w-full bg-gold text-onyx hover:bg-gold-soft font-medium tracking-wide"
                  size="lg"
                  disabled={isLoading || isSyncing || isCheckoutLoading}
                >
                  {isLoading || isSyncing || isCheckoutLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <>
                      <ExternalLink className="w-4 h-4 mr-2" aria-hidden="true" />
                      Finalizar Compra
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
