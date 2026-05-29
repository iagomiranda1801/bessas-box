import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { OrderStatusBadge } from '@/components/admin/OrderStatusBadge';
import { formatCents, formatDate, shortOrderId } from '@/lib/admin-utils';
import { adminDashboardFn } from '@/lib/admin-dashboard.server';
import type { AdminDashboardStats } from '@/lib/admin-dashboard.server';
import type { OrderRow } from '@/lib/order-types';
import { useAdminAuthStore } from '@/stores/adminAuthStore';

export const Route = createFileRoute('/admin/')({
  component: AdminDashboardPage,
  head: () => ({
    meta: [{ title: 'Admin — Dashboard' }, { name: 'robots', content: 'noindex' }],
  }),
});

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="premium-card rounded-xl p-5 space-y-1">
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="font-display text-2xl text-gold">{value}</p>
    </div>
  );
}

function AdminDashboardPage() {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!accessToken) {
        setLoading(false);
        return;
      }
      try {
        const result = await adminDashboardFn({ data: { accessToken } });
        if (!cancelled && result.ok) {
          setStats(result.stats);
          setRecentOrders(result.recentOrders);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  return (
    <AdminLayout title="Dashboard" breadcrumb="Visão geral">
      {loading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Pedidos (7 dias)" value={String(stats?.ordersLast7Days ?? 0)} />
            <StatCard label="Pedidos (30 dias)" value={String(stats?.ordersLast30Days ?? 0)} />
            <StatCard
              label="Receita (pagos)"
              value={formatCents(stats?.revenuePaidCents ?? 0)}
            />
            <StatCard label="Pendentes" value={String(stats?.pendingOrders ?? 0)} />
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <StatCard label="Produtos" value={String(stats?.productCount ?? 0)} />
            <StatCard label="Estoque baixo" value={String(stats?.lowStockCount ?? 0)} />
            <StatCard label="Clientes" value={String(stats?.customerCount ?? 0)} />
          </div>

          <section className="premium-card rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg">Últimos pedidos</h2>
              <Link to="/admin/pedidos" className="text-sm text-gold hover:underline">
                Ver todos
              </Link>
            </div>
            {recentOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum pedido ainda.</p>
            ) : (
              <ul className="divide-y divide-gold/10">
                {recentOrders.map((order) => (
                  <li key={order.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <Link
                        to="/admin/pedidos/$id"
                        params={{ id: order.id }}
                        className="font-mono text-sm hover:text-gold"
                      >
                        #{shortOrderId(order.id)}
                      </Link>
                      <p className="text-xs text-muted-foreground">{order.customer_email}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <OrderStatusBadge status={order.status} />
                      <span className="text-sm text-gold">{formatCents(order.total_cents)}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(order.created_at)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </AdminLayout>
  );
}
