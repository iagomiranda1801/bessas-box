import { useState, useEffect } from "react";

import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

import { Badge } from "@/components/ui/badge";

import { Input } from "@/components/ui/input";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

import { ShoppingBag, Minus, Plus, Trash2, ExternalLink, Loader2 } from "lucide-react";

import { useCartStore } from "@/stores/cartStore";

import { useCustomerStore, truncateEmail } from "@/stores/customerStore";

import { cartCheckoutFn } from "@/lib/customer.server";

import { getMaxPurchasableQuantity } from "@/lib/inventory";

import { toast } from "sonner";



export const CartDrawer = () => {

  const [isOpen, setIsOpen] = useState(false);

  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);

  const [guestEmail, setGuestEmail] = useState("");

  const { items, cartId, pendingVariantId, isSyncing, updateQuantity, removeItem, syncCart, clearCart } =

    useCartStore();

  const accessToken = useCustomerStore((s) => s.accessToken);

  const customerEmail = useCustomerStore((s) => s.email);

  const logout = useCustomerStore((s) => s.logout);

  const isLoggedIn = useCustomerStore((s) => s.isLoggedIn());

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  const totalPrice = items.reduce((sum, item) => sum + (parseFloat(item.price.amount) * item.quantity), 0);

  const currency = items[0]?.price.currencyCode ?? "BRL";



  useEffect(() => {

    if (isOpen) syncCart();

  }, [isOpen, syncCart]);



  const handleCheckout = async () => {

    if (!cartId) return;



    const trimmedGuestEmail = guestEmail.trim();

    if (!isLoggedIn && trimmedGuestEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedGuestEmail)) {

      toast.error("E-mail inválido.", { position: "top-center" });

      return;

    }



    setIsCheckoutLoading(true);

    try {

      const result = await cartCheckoutFn({

        data: {

          cartId,

          ...(isLoggedIn && accessToken ? { customerAccessToken: accessToken } : {}),

          ...(!isLoggedIn && trimmedGuestEmail ? { guestEmail: trimmedGuestEmail } : {}),

        },

      });

      if (!result.ok) {

        if (result.cartNotFound) {

          clearCart();

          toast.error("Sacola expirada — adicione os produtos novamente.", {

            position: "top-center",

          });

        } else {

          toast.error(result.message, {

            position: "top-center",

            duration: 6000,

          });

          await syncCart();

        }

        return;

      }



      useCartStore.setState({ checkoutUrl: result.checkoutUrl });

      window.location.href = result.checkoutUrl;

    } catch {

      toast.error("Não foi possível abrir o pagamento. Tente de novo.", {

        position: "top-center",

      });

    } finally {

      setIsCheckoutLoading(false);

    }

  };



  const handleLogout = async () => {

    await logout();

    toast.success("Você saiu da conta.", { position: "top-center" });

  };



  const handleUpdateQuantity = async (variantId: string, quantity: number) => {

    const result = await updateQuantity(variantId, quantity);

    if (!result.ok) {

      toast.error(result.message, { position: "top-center" });

    }

  };



  const getItemMax = (item: (typeof items)[0]) =>

    getMaxPurchasableQuantity({

      availableForSale: item.availableForSale ?? true,

      quantityAvailable: item.quantityAvailable ?? null,

    });



  const handleRemove = async (variantId: string) => {

    await removeItem(variantId);

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

              <div className="flex-1 overflow-y-auto pr-2 min-h-0 space-y-4">

                <ul className="space-y-4">

                  {items.map((item) => {

                    const maxQty = getItemMax(item);

                    const atMax = item.quantity >= maxQty;

                    const isLinePending = pendingVariantId === item.variantId;

                    return (

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

                        {maxQty > 0 && maxQty <= 10 && (

                          <p className="text-xs text-muted-foreground mt-0.5">

                            {maxQty === 1 ? "Última unidade" : `${maxQty} em estoque`}

                          </p>

                        )}

                      </div>

                      <div className="flex flex-col items-end gap-2 flex-shrink-0">

                        <Button

                          variant="ghost"

                          size="icon"

                          className="h-6 w-6"

                          onClick={() => handleRemove(item.variantId)}

                          disabled={isLinePending}

                          aria-label={`Remover ${item.product.node.title} da sacola`}

                        >

                          {isLinePending ? (

                            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />

                          ) : (

                            <Trash2 className="h-3 w-3" aria-hidden="true" />

                          )}

                        </Button>

                        <div className="flex items-center gap-1" role="group" aria-label={`Quantidade de ${item.product.node.title}`}>

                          <Button

                            variant="outline"

                            size="icon"

                            className="h-6 w-6"

                            onClick={() => handleUpdateQuantity(item.variantId, item.quantity - 1)}

                            disabled={isLinePending}

                            aria-label="Diminuir quantidade"

                          >

                            <Minus className="h-3 w-3" aria-hidden="true" />

                          </Button>

                          <span className="w-8 text-center text-sm" aria-live="polite">

                            {isLinePending ? (

                              <Loader2 className="h-3 w-3 animate-spin mx-auto" aria-hidden="true" />

                            ) : (

                              item.quantity

                            )}

                          </span>

                          <Button

                            variant="outline"

                            size="icon"

                            className="h-6 w-6"

                            onClick={() => handleUpdateQuantity(item.variantId, item.quantity + 1)}

                            disabled={atMax || isLinePending}

                            aria-label="Aumentar quantidade"

                          >

                            <Plus className="h-3 w-3" aria-hidden="true" />

                          </Button>

                        </div>

                      </div>

                    </li>

                    );

                  })}

                </ul>



                <div className="rounded-lg border border-gold/20 bg-card/30 p-4 space-y-3 text-sm">

                  {isLoggedIn && customerEmail ? (

                    <div className="flex items-center justify-between gap-2">

                      <p className="text-muted-foreground">

                        Olá,{" "}

                        <span className="text-foreground">{truncateEmail(customerEmail)}</span>

                      </p>

                      <button

                        type="button"

                        onClick={handleLogout}

                        className="text-gold hover:text-gold-soft text-xs tracking-wide shrink-0"

                      >

                        Sair

                      </button>

                    </div>

                  ) : (

                    <>

                      <div className="flex flex-wrap gap-x-4 gap-y-1">

                        <Link

                          to="/conta/entrar"

                          onClick={() => setIsOpen(false)}

                          className="text-gold hover:text-gold-soft transition-colors"

                        >

                          Entrar

                        </Link>

                        <Link

                          to="/conta/cadastro"

                          onClick={() => setIsOpen(false)}

                          className="text-gold hover:text-gold-soft transition-colors"

                        >

                          Criar conta

                        </Link>

                      </div>

                      <div className="space-y-1.5">

                        <label htmlFor="guest-email" className="text-xs text-muted-foreground tracking-wide">

                          E-mail (opcional — pré-preenche o checkout)

                        </label>

                        <Input

                          id="guest-email"

                          type="email"

                          value={guestEmail}

                          onChange={(e) => setGuestEmail(e.target.value)}

                          placeholder="voce@email.com"

                          autoComplete="email"

                          className="border-gold/30 bg-background/80 h-9 text-sm"

                        />

                      </div>

                    </>

                  )}

                </div>

              </div>

              <div className="flex-shrink-0 space-y-3 pt-4 border-t border-gold/20 bg-background">

                <div className="flex justify-between items-center">

                  <span className="text-lg font-medium tracking-wide">Total</span>

                  <span className="text-2xl font-bold text-gold">

                    {currency} {totalPrice.toFixed(2)}

                  </span>

                </div>

                <p className="text-xs text-muted-foreground text-center leading-relaxed">

                  Pagamento seguro na Shopify. Cadastro não é obrigatório.

                </p>

                <Button

                  onClick={handleCheckout}

                  className="w-full bg-gold text-onyx hover:bg-gold-soft font-medium tracking-wide"

                  size="lg"

                  disabled={pendingVariantId != null || isSyncing || isCheckoutLoading}

                >

                  {pendingVariantId != null || isSyncing || isCheckoutLoading ? (

                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />

                  ) : (

                    <>

                      <ExternalLink className="w-4 h-4 mr-2" aria-hidden="true" />

                      Finalizar compra

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


