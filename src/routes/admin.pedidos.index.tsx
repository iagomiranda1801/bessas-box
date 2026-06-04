import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { DeleteOrderButton } from '@/components/admin/DeleteOrderButton';
import { OrderStatusBadge } from '@/components/admin/OrderStatusBadge';
import { Input } from '@/components/ui/input';
import { adminListOrdersFn } from '@/lib/orders.server';
import { formatCents, formatDate, shortOrderId } from '@/lib/admin-utils';
import type { OrderRow } from '@/lib/order-types';
import { useAdminAuthStore } from '@/stores/adminAuthStore';

export const Route = createFileRoute('/admin/pedidos/')({
  component: AdminOrdersPage,
  head: () => ({
    meta: [{ title: 'Admin — Pedidos' }, { name: 'robots', content: 'noindex' }],
  }),
});

function AdminOrdersPage() {
  const navigate = useNavigate();
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) {
      setLoading(false);
      navigate({ to: '/admin/login' });
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const result = await adminListOrdersFn({
        data: { accessToken, email: email || undefined },
      });
      if (!result.ok) {
        setLoadError(result.message);
        setOrders([]);
        toast.error(result.message);
        return;
      }
      setOrders(result.orders);
    } catch {
      const msg = 'Não foi possível carregar os pedidos.';
      setLoadError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [accessToken, email, navigate]);

  useEffect(() => {
    void load();
  }, [load]);

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
      ) : loadError ? (
        <div className="premium-card rounded-xl p-10 text-center space-y-2">
          <p className="text-destructive text-sm">{loadError}</p>
          <p className="text-xs text-muted-foreground">
            Verifique se as migrations de pedidos e pagamento foram aplicadas no Supabase.
          </p>
        </div>
      ) : orders.length === 0 ? (
        <div className="premium-card rounded-xl p-10 text-center text-muted-foreground">
          <p>Nenhum pedido encontrado.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => (
            <li key={order.id} className="premium-card rounded-lg p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Link
                  to="/admin/pedidos/$id"
                  params={{ id: order.id }}
                  className="flex-1 min-w-0 hover:opacity-90"
                >
                  <p className="font-mono text-sm">#{shortOrderId(order.id)}</p>
                  <p className="text-sm text-muted-foreground">{order.customer_email}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDate(order.created_at)}
                  </p>
                </Link>
                <div className="flex flex-wrap items-center gap-3">
                  <OrderStatusBadge status={order.status} />
                  <span className="text-gold font-medium">{formatCents(order.total_cents)}</span>
                  <DeleteOrderButton
                    orderId={order.id}
                    accessToken={accessToken}
                    onDeleted={() => void load()}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AdminLayout>
  );
}
