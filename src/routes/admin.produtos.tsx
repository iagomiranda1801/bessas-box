import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { adminListProductsFn, adminToggleProductFn } from '@/lib/admin.server';
import { formatCents } from '@/lib/admin-utils';
import type { AdminProductRow } from '@/lib/catalog-types';
import { useAdminAuthStore } from '@/stores/adminAuthStore';

export const Route = createFileRoute('/admin/produtos')({
  component: AdminProductsPage,
  head: () => ({
    meta: [{ title: 'Admin — Produtos' }, { name: 'robots', content: 'noindex' }],
  }),
});

function AdminProductsPage() {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const [products, setProducts] = useState<AdminProductRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const result = await adminListProductsFn({ data: { accessToken } });
      if (result.ok) setProducts(result.products);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [accessToken]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q),
    );
  }, [products, search]);

  const handleToggle = async (id: string, field: 'is_active' | 'is_featured', value: boolean) => {
    if (!accessToken) return;
    const result = await adminToggleProductFn({
      data: { accessToken, id, field, value },
    });
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
    );
  };

  return (
    <AdminLayout
      title="Produtos"
      breadcrumb="Catálogo"
      actions={
        <Button asChild className="bg-gold text-onyx hover:bg-gold-soft">
          <Link to="/admin/produtos/novo">Novo produto</Link>
        </Button>
      }
    >
      <Input
        placeholder="Buscar por título ou slug…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md border-gold/30"
      />

      {loading ? (
        <p className="text-muted-foreground">Carregando produtos…</p>
      ) : filtered.length === 0 ? (
        <div className="premium-card rounded-xl p-10 text-center text-muted-foreground">
          <p className="font-display text-xl text-foreground mb-2">Nenhum produto</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((p) => (
            <li
              key={p.id}
              className="premium-card rounded-lg p-4 flex flex-wrap items-center justify-between gap-4"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">{p.title}</p>
                <p className="text-xs text-muted-foreground font-mono">{p.slug}</p>
                <p className="text-sm text-gold mt-1">
                  {formatCents(p.price_cents)} · estoque {p.stock_quantity}
                </p>
                <div className="flex flex-wrap gap-4 mt-3">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={p.is_active}
                      onCheckedChange={(v) => handleToggle(p.id, 'is_active', v === true)}
                    />
                    Ativo
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={p.is_featured}
                      onCheckedChange={(v) => handleToggle(p.id, 'is_featured', v === true)}
                    />
                    Destaque
                  </label>
                </div>
              </div>
              <Button asChild variant="outline" size="sm" className="border-gold/40">
                <Link to="/admin/produtos/$id" params={{ id: p.id }}>
                  Editar
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </AdminLayout>
  );
}
