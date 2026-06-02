import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { z } from 'zod';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { PixPaymentPanel } from '@/components/checkout/PixPaymentPanel';
import { Button } from '@/components/ui/button';
import { getCheckoutPaymentFn, getOrderPaymentStatusFn } from '@/lib/checkout.server';
import { formatCents, shortOrderId } from '@/lib/admin-utils';

export const Route = createFileRoute('/checkout/pagar/$orderId')({
  params: {
    parse: (params) => ({
      orderId: z.string().uuid().parse(params.orderId),
    }),
    stringify: ({ orderId }) => ({ orderId }),
  },
  component: CheckoutPaymentPage,
  head: () => ({
    meta: [{ title: "Pagamento Pix — Bessa's Box" }],
  }),
});

type PaymentOrder = {
  id: string;
  status: string;
  totalCents: number;
  items: Array<{ product_title: string; quantity: number; unit_price_cents: number }>;
  pixQrCode: string | null;
  pixCopyPaste: string | null;
  expiresAt: string | null;
  isDemo: boolean;
};

function CheckoutPaymentPage() {
  const { orderId } = Route.useParams();
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showItems, setShowItems] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const result = await getCheckoutPaymentFn({ data: { orderId } });
      if (cancelled) return;
      if (!result.ok) {
        setError(result.message);
        setOrder(null);
      } else {
        setOrder(result.order);
      }
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  useEffect(() => {
    if (!order || order.status === 'paid' || order.status === 'cancelled') return;

    const interval = setInterval(async () => {
      const result = await getOrderPaymentStatusFn({ data: { orderId } });
      if (!result.ok) return;
      if (result.status === 'paid' || result.status === 'cancelled') {
        setOrder((prev) => (prev ? { ...prev, status: result.status } : prev));
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [order, orderId]);

  const panelStatus =
    order?.status === 'paid'
      ? 'paid'
      : order?.status === 'cancelled'
        ? 'cancelled'
        : 'awaiting';

  return (
    <div className="min-h-screen bg-background bg-mesh-dark">
      <SiteHeader homeOnlyNav={false} />
      <main className="pt-24 pb-16 max-w-lg mx-auto px-4">
        {loading ? (
          <p className="text-center text-muted-foreground text-sm">Carregando pagamento…</p>
        ) : error || !order ? (
          <div className="premium-card rounded-xl p-8 text-center space-y-4">
            <p className="text-sm text-muted-foreground">{error ?? 'Pedido não encontrado.'}</p>
            <Button asChild variant="outline" className="border-gold/40">
              <Link to="/colecao">Voltar à loja</Link>
            </Button>
          </div>
        ) : (
          <div className="premium-card rounded-xl p-6 sm:p-8 space-y-6 animate-fade-in-up">
            <div className="text-center space-y-1">
              <p className="text-gold text-xs tracking-[0.25em] uppercase">Pagamento Pix</p>
              <h1 className="font-display text-2xl sm:text-3xl">Finalize seu pedido</h1>
              <p className="text-xs text-muted-foreground font-mono">#{shortOrderId(order.id)}</p>
            </div>

            <PixPaymentPanel
              pixQrCode={order.pixQrCode}
              pixCopyPaste={order.pixCopyPaste}
              expiresAt={order.expiresAt}
              isDemo={order.isDemo}
              status={panelStatus}
              totalLabel={formatCents(order.totalCents)}
            />

            {order.items.length > 0 && (
              <div className="border-t border-gold/10 pt-4">
                <button
                  type="button"
                  onClick={() => setShowItems((v) => !v)}
                  className="flex w-full items-center justify-between text-sm text-muted-foreground hover:text-foreground"
                >
                  <span>Resumo do pedido ({order.items.length} itens)</span>
                  {showItems ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showItems && (
                  <ul className="mt-3 space-y-2 text-sm">
                    {order.items.map((item, i) => (
                      <li key={i} className="flex justify-between gap-2">
                        <span className="text-muted-foreground">
                          {item.product_title} × {item.quantity}
                        </span>
                        <span className="text-gold shrink-0">
                          {formatCents(item.unit_price_cents * item.quantity)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              {panelStatus === 'paid' ? (
                <Button asChild className="bg-gold text-onyx hover:bg-gold-soft w-full">
                  <Link to="/conta/pedidos/$id" params={{ id: order.id }}>
                    Ver meu pedido
                  </Link>
                </Button>
              ) : (
                <Button asChild variant="outline" className="border-gold/40 w-full">
                  <Link to="/colecao">Continuar comprando</Link>
                </Button>
              )}
            </div>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
