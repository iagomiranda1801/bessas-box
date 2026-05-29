import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Package } from 'lucide-react';
import { AccountShell } from '@/components/AccountShell';
import { OrderStatusBadge } from '@/components/admin/OrderStatusBadge';
import { customerListOrdersFn } from '@/lib/customer.server';
import { formatCents, formatDate, shortOrderId } from '@/lib/admin-utils';
import type { OrderRow } from '@/lib/order-types';
import { useCustomerStore } from '@/stores/customerStore';

export const Route = createFileRoute('/conta/pedidos')({
  component: CustomerOrdersPage,
  head: () => ({
    meta: [
      { title: "Meus pedidos — Bessa's Box" },
      { name: 'description', content: 'Acompanhe seus pedidos na Bessa\'s Box.' },
    ],
  }),
});

function CustomerOrdersPage() {
  const accessToken = useCustomerStore((s) => s.accessToken);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;

    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const result = await customerListOrdersFn({ data: { accessToken } });
      if (cancelled) return;
      if (!result.ok) {
        setError(result.message);
        setOrders([]);
      } else {
        setOrders(result.orders);
      }
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  return (
    <AccountShell
      title="Meus pedidos"
      description="Pedidos vinculados à sua conta ou ao mesmo e-mail do cadastro."
      returnTo="/conta/pedidos"
    >
      {loading ? (
        <p className="text-muted-foreground text-sm">Carregando pedidos…</p>
      ) : error ? (
        <div className="premium-card rounded-xl p-6 text-center space-y-3">
          <p className="text-sm text-destructive">{error}</p>
          <Link to="/conta/entrar" search={{ returnTo: '/conta/pedidos' }} className="text-sm text-gold hover:text-gold-soft">
            Entrar novamente
          </Link>
        </div>
      ) : orders.length === 0 ? (
        <div className="premium-card rounded-xl p-10 text-center space-y-4">
          <Package className="w-10 h-10 text-muted-foreground mx-auto" aria-hidden="true" />
          <p className="text-muted-foreground">Você ainda não tem pedidos.</p>
          <Link
            to="/colecao"
            className="inline-flex items-center justify-center rounded-md bg-gold px-4 py-2 text-sm font-medium text-onyx hover:bg-gold-soft transition-colors"
          >
            Ver coleção
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                to="/conta/pedidos/$id"
                params={{ id: order.id }}
                className="premium-card rounded-lg p-4 flex flex-wrap items-center justify-between gap-3 hover:border-gold/40 transition-colors block"
              >
                <div>
                  <p className="font-mono text-sm">#{shortOrderId(order.id)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{formatDate(order.created_at)}</p>
                  {order.order_items && order.order_items.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      {order.order_items.map((i) => i.product_title).join(' · ')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <OrderStatusBadge status={order.status} />
                  <span className="text-gold font-medium">{formatCents(order.total_cents)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AccountShell>
  );
}
