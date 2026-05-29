import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { OrderStatusBadge } from '@/components/admin/OrderStatusBadge';
import { Input } from '@/components/ui/input';
import { adminListOrdersFn } from '@/lib/orders.server';
import { formatCents, formatDate, shortOrderId } from '@/lib/admin-utils';
import type { OrderRow } from '@/lib/order-types';
import { useAdminAuthStore } from '@/stores/adminAuthStore';

export const Route = createFileRoute('/admin/pedidos')({
  component: AdminOrdersPage,
  head: () => ({
    meta: [{ title: 'Admin — Pedidos' }, { name: 'robots', content: 'noindex' }],
  }),
});

function AdminOrdersPage() {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!accessToken) {
        setLoading(false);
        return;
      }
      const result = await adminListOrdersFn({
        data: { accessToken, email: email || undefined },
      });
      if (!cancelled && result.ok) setOrders(result.orders);
      if (!cancelled) setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken, email]);

  return (
    <AdminLayout title="Pedidos" breadcrumb="Vendas">
      <Input
        placeholder="Filtrar por e-mail…"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="max-w-md border-gold/30"
      />

      {loading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : orders.length === 0 ? (
        <div className="premium-card rounded-xl p-10 text-center text-muted-foreground">
          <p>Nenhum pedido encontrado.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => (
            <li key={order.id} className="premium-card rounded-lg p-4">
              <Link
                to="/admin/pedidos/$id"
                params={{ id: order.id }}
                className="flex flex-wrap items-center justify-between gap-3 hover:opacity-90"
              >
                <div>
                  <p className="font-mono text-sm">#{shortOrderId(order.id)}</p>
                  <p className="text-sm text-muted-foreground">{order.customer_email}</p>
                  <p className="text-xs text-muted-foreground mt-1">{formatDate(order.created_at)}</p>
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
    </AdminLayout>
  );
}
