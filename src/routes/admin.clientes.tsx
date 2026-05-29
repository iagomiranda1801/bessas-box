import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Input } from '@/components/ui/input';
import { adminListCustomersFn } from '@/lib/customers.server';
import { formatDate } from '@/lib/admin-utils';
import type { AdminCustomerRow } from '@/lib/order-types';
import { useAdminAuthStore } from '@/stores/adminAuthStore';

export const Route = createFileRoute('/admin/clientes')({
  component: AdminCustomersPage,
  head: () => ({
    meta: [{ title: 'Admin — Clientes' }, { name: 'robots', content: 'noindex' }],
  }),
});

function AdminCustomersPage() {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const [customers, setCustomers] = useState<AdminCustomerRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!accessToken) {
        setLoading(false);
        return;
      }
      const result = await adminListCustomersFn({
        data: { accessToken, search: search || undefined },
      });
      if (!cancelled && result.ok) setCustomers(result.customers);
      if (!cancelled) setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken, search]);

  const display = useMemo(() => customers, [customers]);

  return (
    <AdminLayout title="Clientes" breadcrumb="Contas">
      <Input
        placeholder="Buscar por e-mail ou nome…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md border-gold/30"
      />

      {loading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : display.length === 0 ? (
        <div className="premium-card rounded-xl p-10 text-center text-muted-foreground">
          <p>Nenhum cliente cadastrado.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {display.map((c) => (
            <li key={c.id} className="premium-card rounded-lg p-4">
              <Link
                to="/admin/clientes/$id"
                params={{ id: c.id }}
                className="flex flex-wrap justify-between gap-2 hover:opacity-90"
              >
                <div>
                  <p className="font-medium">{c.full_name || 'Sem nome'}</p>
                  <p className="text-sm text-muted-foreground">{c.email}</p>
                  <p className="text-xs text-muted-foreground mt-1">{formatDate(c.created_at)}</p>
                </div>
                <span className="text-sm text-gold">{c.order_count} pedido(s)</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AdminLayout>
  );
}
