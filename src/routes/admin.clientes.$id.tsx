import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { OrderStatusBadge } from '@/components/admin/OrderStatusBadge';
import { Button } from '@/components/ui/button';
import { adminGetCustomerFn } from '@/lib/customers.server';
import { formatCents, formatDate } from '@/lib/admin-utils';
import type { AdminCustomerRow, OrderRow } from '@/lib/order-types';
import { useAdminAuthStore } from '@/stores/adminAuthStore';

export const Route = createFileRoute('/admin/clientes/$id')({
  component: AdminCustomerDetailPage,
  head: () => ({
    meta: [{ title: 'Admin — Cliente' }, { name: 'robots', content: 'noindex' }],
  }),
});

function AdminCustomerDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const [customer, setCustomer] = useState<AdminCustomerRow | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const result = await adminGetCustomerFn({ data: { accessToken, id } });
      if (!result.ok) {
        toast.error(result.message);
        navigate({ to: '/admin/clientes' });
        return;
      }
      setCustomer(result.customer);
      setOrders(result.orders);
    } finally {
      setLoading(false);
    }
  }, [accessToken, id, navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <AdminLayout title="Cliente">
        <p className="text-muted-foreground">Carregando…</p>
      </AdminLayout>
    );
  }

  if (!customer) return null;

  return (
    <AdminLayout
      title={customer.full_name || customer.email}
      breadcrumb="Clientes"
      actions={
        <Button asChild variant="outline" size="sm" className="border-gold/40">
          <Link to="/admin/clientes">Voltar</Link>
        </Button>
      }
    >
      <div className="premium-card rounded-xl p-6 space-y-2 max-w-lg">
        <p className="text-sm">
          <span className="text-muted-foreground">E-mail:</span> {customer.email}
        </p>
        {customer.phone && (
          <p className="text-sm">
            <span className="text-muted-foreground">Telefone:</span> {customer.phone}
          </p>
        )}
        <p className="text-sm">
          <span className="text-muted-foreground">Cadastro:</span> {formatDate(customer.created_at)}
        </p>
      </div>

      <section className="premium-card rounded-xl p-6 space-y-4">
        <h2 className="font-display text-lg">Pedidos</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum pedido.</p>
        ) : (
          <ul className="divide-y divide-gold/10">
            {orders.map((order) => (
              <li key={order.id} className="py-3 flex flex-wrap justify-between gap-2">
                <Link
                  to="/admin/pedidos/$id"
                  params={{ id: order.id }}
                  className="text-sm hover:text-gold"
                >
                  {formatDate(order.created_at)}
                </Link>
                <div className="flex items-center gap-3">
                  <OrderStatusBadge status={order.status} />
                  <span className="text-gold text-sm">{formatCents(order.total_cents)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminLayout>
  );
}
