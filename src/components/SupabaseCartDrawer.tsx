import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ExternalLink, Loader2, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { createSupabaseOrderFn } from '@/lib/checkout.server';
import { formatCents } from '@/lib/admin-utils';
import { useSupabaseCartStore } from '@/stores/supabaseCartStore';

export function SupabaseCartDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [shippingName, setShippingName] = useState('');
  const items = useSupabaseCartStore((s) => s.items);
  const updateQuantity = useSupabaseCartStore((s) => s.updateQuantity);
  const removeItem = useSupabaseCartStore((s) => s.removeItem);
  const clearCart = useSupabaseCartStore((s) => s.clearCart);
  const totalCents = useSupabaseCartStore((s) => s.totalCents());

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);

  const handleCheckout = async () => {
    const trimmedEmail = email.trim();
    const name = shippingName.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast.error('Informe um e-mail válido.', { position: 'top-center' });
      return;
    }
    if (!name) {
      toast.error('Informe o nome para entrega.', { position: 'top-center' });
      return;
    }
    if (items.length === 0) return;

    setLoading(true);
    try {
      const result = await createSupabaseOrderFn({
        data: {
          customerEmail: trimmedEmail,
          shippingName: name,
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        },
      });
      if (!result.ok) {
        toast.error(result.message, { position: 'top-center' });
        return;
      }
      clearCart();
      setIsOpen(false);
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      } else {
        toast.success('Pedido criado!', { position: 'top-center' });
      }
    } catch {
      toast.error('Não foi possível finalizar. Tente novamente.', { position: 'top-center' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-foreground hover:text-gold"
          aria-label="Sacola"
        >
          <ShoppingBag className="w-5 h-5" />
          {totalItems > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gold text-onyx text-xs flex items-center justify-center font-medium">
              {totalItems}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md bg-background border-gold/20 flex flex-col">
        <SheetHeader>
          <SheetTitle className="font-display">Sacola</SheetTitle>
          <SheetDescription>Checkout Bessa&apos;s Box</SheetDescription>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
            <p>Sua sacola está vazia.</p>
            <Button asChild variant="outline" className="border-gold/40" onClick={() => setIsOpen(false)}>
              <Link to="/colecao">Ver coleção</Link>
            </Button>
          </div>
        ) : (
          <>
            <ul className="flex-1 overflow-y-auto space-y-4 py-4">
              {items.map((item) => (
                <li key={item.productId} className="flex gap-3">
                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="w-16 h-16 object-cover rounded border border-gold/20"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    <p className="text-xs text-gold">{formatCents(item.priceCents * item.quantity)}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-7 w-7 border-gold/30"
                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="text-sm w-6 text-center">{item.quantity}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-7 w-7 border-gold/30"
                        onClick={() => {
                          const r = updateQuantity(item.productId, item.quantity + 1);
                          if (!r.ok) toast.error(r.message, { position: 'top-center' });
                        }}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground"
                        onClick={() => removeItem(item.productId)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="border-t border-gold/20 pt-4 space-y-3">
              <Input
                placeholder="E-mail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border-gold/30"
              />
              <Input
                placeholder="Nome completo (entrega)"
                value={shippingName}
                onChange={(e) => setShippingName(e.target.value)}
                className="border-gold/30"
              />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="text-gold font-medium">{formatCents(totalCents())}</span>
              </div>
              <Button
                className="w-full bg-gold text-onyx hover:bg-gold-soft"
                disabled={loading}
                onClick={handleCheckout}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processando…
                  </>
                ) : (
                  <>
                    Finalizar compra
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
