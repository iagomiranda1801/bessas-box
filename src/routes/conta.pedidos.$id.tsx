import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { AccountShell } from '@/components/AccountShell';
import { OrderStatusBadge } from '@/components/admin/OrderStatusBadge';
import { customerGetOrderFn } from '@/lib/customer.server';
import { formatCents, formatDate, shortOrderId } from '@/lib/admin-utils';
import type { OrderRow } from '@/lib/order-types';
import { getCorreiosTrackingUrl } from '@/lib/shipping/correios-service';
import { useCustomerStore } from '@/stores/customerStore';

export const Route = createFileRoute('/conta/pedidos/$id')({
  component: CustomerOrderDetailPage,
  head: () => ({
    meta: [{ title: "Detalhe do pedido — Bessa's Box" }],
  }),
});

function CustomerOrderDetailPage() {
  const { id } = Route.useParams();
  const accessToken = useCustomerStore((s) => s.accessToken);
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;

    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const result = await customerGetOrderFn({ data: { accessToken, id } });
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
  }, [accessToken, id]);

  return (
    <AccountShell
      title={order ? `Pedido #${shortOrderId(order.id)}` : 'Pedido'}
      returnTo={`/conta/pedidos/${id}`}
    >
      <Link
        to="/conta/pedidos"
        className="inline-block text-sm text-gold hover:text-gold-soft mb-6 -mt-2"
      >
        ← Voltar aos pedidos
      </Link>

      {loading ? (
        <p className="text-muted-foreground text-sm">Carregando…</p>
      ) : error || !order ? (
        <div className="premium-card rounded-xl p-6 text-center space-y-3">
          <p className="text-sm text-muted-foreground">{error ?? 'Pedido não encontrado.'}</p>
          <Link to="/conta/pedidos" className="text-sm text-gold hover:text-gold-soft">
            Voltar à lista
          </Link>
        </div>
      ) : (
        <div className="space-y-6 animate-fade-in-up">
              <div className="flex flex-wrap items-center justify-between gap-3 -mt-2">
                <p className="text-sm text-muted-foreground">{formatDate(order.created_at)}</p>
                <OrderStatusBadge status={order.status} />
              </div>

              {(order.status === 'pending' || order.status === 'awaiting_payment') && (
                <div className="premium-card rounded-xl p-5 space-y-3 border-gold/30">
                  <div>
                    <p className="text-sm font-medium text-foreground">Pagamento pendente</p>
                    <p className="text-xs text-muted-foreground">
                      Conclua o pagamento para liberar o envio do seu pedido.
                    </p>
                  </div>
                  <Link
                    to="/checkout/pagar/$orderId"
                    params={{ orderId: order.id }}
                    className="inline-flex w-full items-center justify-center rounded-md bg-gold px-4 py-2.5 text-sm font-medium text-onyx transition-colors hover:bg-gold-soft"
                  >
                    Pagar agora
                  </Link>
                </div>
              )}

              <div className="premium-card rounded-xl p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">
                    {order.status === 'pending' || order.status === 'awaiting_payment'
                      ? 'Total'
                      : 'Total pago'}
                  </span>
                  <span className="text-gold font-display text-xl">{formatCents(order.total_cents)}</span>
                </div>

                {order.shipments?.[0]?.tracking_code && (
                  <div className="text-sm space-y-1 pt-2 border-t border-gold/10">
                    <p className="text-muted-foreground">Rastreamento</p>
                    <p className="font-mono">{order.shipments[0].tracking_code}</p>
                    {order.shipments[0].shipping_method === 'correios' && (
                      <a
                        href={getCorreiosTrackingUrl(order.shipments[0].tracking_code)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gold hover:underline text-xs"
                      >
                        Rastrear ↗
                      </a>
                    )}
                    {order.shipments[0].estimated_delivery_date && (
                      <p className="text-muted-foreground text-xs">
                        Previsão: {new Date(order.shipments[0].estimated_delivery_date).toLocaleDateString('pt-BR')}
                      </p>
                    )}
                  </div>
                )}

                {order.order_items && order.order_items.length > 0 && (
                  <ul className="space-y-3 pt-2 border-t border-gold/10">
                    <p className="text-sm text-muted-foreground">Itens</p>
                    {order.order_items.map((item) => (
                      <li key={item.id} className="flex justify-between gap-3 text-sm">
                        <span>
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
        </div>
      )}
    </AccountShell>
  );
}
