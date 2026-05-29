import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { AccountShell } from '@/components/AccountShell';
import { OrderStatusBadge } from '@/components/admin/OrderStatusBadge';
import { customerGetOrderFn } from '@/lib/customer.server';
import { formatCents, formatDate, shortOrderId } from '@/lib/admin-utils';
import { ORDER_STATUS_LABELS, type OrderRow, type OrderStatus } from '@/lib/order-types';
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
  const [history, setHistory] = useState<
    Array<{ status: OrderStatus; created_at: string; changed_by: string | null }>
  >([]);
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
        setHistory(result.history);
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

              <div className="premium-card rounded-xl p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Total</span>
                  <span className="text-gold font-display text-xl">{formatCents(order.total_cents)}</span>
                </div>

                {order.shipping_name && (
                  <div className="text-sm space-y-1 pt-2 border-t border-gold/10">
                    <p className="text-muted-foreground">Entrega</p>
                    <p>{order.shipping_name}</p>
                    {order.shipping_phone && <p className="text-muted-foreground">{order.shipping_phone}</p>}
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

                {order.status === 'awaiting_payment' && (
                  <p className="text-xs text-amber-200/90 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">
                    Aguardando confirmação do pagamento. Se já pagou, o status será atualizado em breve.
                  </p>
                )}
              </div>

              {history.length > 0 && (
                <div className="premium-card rounded-xl p-6 space-y-3">
                  <p className="text-sm text-muted-foreground">Histórico</p>
                  <ul className="space-y-2 text-sm">
                    {history.map((entry, i) => (
                      <li key={i} className="flex justify-between gap-2">
                        <span>{ORDER_STATUS_LABELS[entry.status] ?? entry.status}</span>
                        <span className="text-muted-foreground text-xs">{formatDate(entry.created_at)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
        </div>
      )}
    </AccountShell>
  );
}
