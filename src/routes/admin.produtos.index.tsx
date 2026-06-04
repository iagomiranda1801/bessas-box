import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from '@/components/ui/pagination';
import { adminListProductsFn, adminToggleProductFn } from '@/lib/admin.server';
import { formatCents } from '@/lib/admin-utils';
import type { AdminProductRow } from '@/lib/catalog-types';
import { useAdminAuthStore } from '@/stores/adminAuthStore';

const PAGE_SIZE = 12;

export const Route = createFileRoute('/admin/produtos/')({
  component: AdminProductsPage,
  head: () => ({
    meta: [{ title: 'Admin — Produtos' }, { name: 'robots', content: 'noindex' }],
  }),
});

function productThumbUrl(product: AdminProductRow): string | null {
  const images = [...(product.product_images ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  const primary = images.find((img) => img.is_primary) ?? images[0];
  return primary?.public_url ?? null;
}

function AdminProductsPage() {
  const navigate = useNavigate();
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const [products, setProducts] = useState<AdminProductRow[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
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

  useEffect(() => {
    setPage(1);
  }, [search]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q),
    );
  }, [products, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paginated = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  const rangeStart = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, filtered.length);

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
        <Button
          type="button"
          className="bg-gold text-onyx hover:bg-gold-soft"
          onClick={() => navigate({ to: '/admin/produtos/novo' })}
        >
          Novo produto
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
        <div className="space-y-4">
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {paginated.map((p) => {
              const thumb = productThumbUrl(p);
              return (
                <li
                  key={p.id}
                  className="premium-card rounded-lg p-3 flex flex-col gap-3 h-full"
                >
                  <div className="flex gap-3 min-w-0">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt=""
                        className="w-14 h-14 rounded-md object-cover border border-gold/20 shrink-0"
                      />
                    ) : (
                      <div
                        className="w-14 h-14 rounded-md border border-gold/20 bg-muted/40 shrink-0"
                        aria-hidden
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{p.title}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate">
                        {p.slug}
                      </p>
                      <p className="text-sm text-gold mt-0.5">
                        {formatCents(p.price_cents)} · estoque {p.stock_quantity}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mt-auto">
                    <div className="flex flex-wrap gap-3">
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
                    <Button asChild variant="outline" size="sm" className="border-gold/40 shrink-0">
                      <Link to="/admin/produtos/$id" params={{ id: p.id }}>
                        Editar
                      </Link>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>

          {filtered.length > PAGE_SIZE && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <p className="text-sm text-muted-foreground">
                Mostrando {rangeStart}–{rangeEnd} de {filtered.length} produto
                {filtered.length === 1 ? '' : 's'}
              </p>
              <Pagination className="mx-0 w-auto">
                <PaginationContent>
                  <PaginationItem>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-gold/40"
                      disabled={safePage <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Anterior
                    </Button>
                  </PaginationItem>
                  <PaginationItem>
                    <span className="text-sm px-3 whitespace-nowrap">
                      Página {safePage} de {totalPages}
                    </span>
                  </PaginationItem>
                  <PaginationItem>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-gold/40"
                      disabled={safePage >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Próxima
                    </Button>
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>
      )}
    </AdminLayout>
  );
}
