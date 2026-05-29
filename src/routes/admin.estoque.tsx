import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { adminAdjustStockFn, adminListProductsFn } from '@/lib/admin.server';
import { formatCents } from '@/lib/admin-utils';
import type { AdminProductRow } from '@/lib/catalog-types';
import { useAdminAuthStore } from '@/stores/adminAuthStore';

const LOW_STOCK = 3;

export const Route = createFileRoute('/admin/estoque')({
  component: AdminStockPage,
  head: () => ({
    meta: [{ title: 'Admin — Estoque' }, { name: 'robots', content: 'noindex' }],
  }),
});

function AdminStockPage() {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const [products, setProducts] = useState<AdminProductRow[]>([]);
  const [lowOnly, setLowOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState('');

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

  const sorted = useMemo(() => {
    let list = [...products].sort((a, b) => a.stock_quantity - b.stock_quantity);
    if (lowOnly) list = list.filter((p) => p.stock_quantity <= LOW_STOCK);
    return list;
  }, [products, lowOnly]);

  const saveStock = async (id: string) => {
    if (!accessToken) return;
    const qty = parseInt(editQty, 10);
    if (Number.isNaN(qty) || qty < 0) {
      toast.error('Quantidade inválida.');
      return;
    }
    const result = await adminAdjustStockFn({
      data: { accessToken, id, stockQuantity: qty },
    });
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success('Estoque atualizado.');
    setEditingId(null);
    await load();
  };

  return (
    <AdminLayout title="Estoque" breadcrumb="Inventário">
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <Checkbox checked={lowOnly} onCheckedChange={(v) => setLowOnly(v === true)} />
        Mostrar só estoque baixo (≤ {LOW_STOCK})
      </label>

      {loading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : sorted.length === 0 ? (
        <div className="premium-card rounded-xl p-10 text-center text-muted-foreground">
          <p>Nenhum produto neste filtro.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {sorted.map((p) => (
            <li
              key={p.id}
              className="premium-card rounded-lg p-4 flex flex-wrap items-center justify-between gap-3"
            >
              <div>
                <p className="font-medium">{p.title}</p>
                <p className="text-sm text-gold">{formatCents(p.price_cents)}</p>
              </div>
              {editingId === p.id ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    value={editQty}
                    onChange={(e) => setEditQty(e.target.value)}
                    className="w-24 border-gold/30"
                  />
                  <Button size="sm" onClick={() => saveStock(p.id)} className="bg-gold text-onyx">
                    Salvar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                    Cancelar
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span
                    className={
                      p.stock_quantity <= LOW_STOCK ? 'text-red-400 font-medium' : 'text-foreground'
                    }
                  >
                    {p.stock_quantity} un.
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-gold/40"
                    onClick={() => {
                      setEditingId(p.id);
                      setEditQty(String(p.stock_quantity));
                    }}
                  >
                    Ajustar
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </AdminLayout>
  );
}
