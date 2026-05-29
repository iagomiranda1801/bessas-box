import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { OrderStatusBadge } from '@/components/admin/OrderStatusBadge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { adminGetOrderFn, adminUpdateOrderStatusFn } from '@/lib/orders.server';
import { formatCents, formatDate, shortOrderId } from '@/lib/admin-utils';
import { ORDER_STATUSES, ORDER_STATUS_LABELS, type OrderRow, type OrderStatus } from '@/lib/order-types';
import { useAdminAuthStore } from '@/stores/adminAuthStore';

export const Route = createFileRoute('/admin/pedidos/$id')({
  component: AdminOrderDetailPage,
  head: () => ({
    meta: [{ title: 'Admin — Pedido' }, { name: 'robots', content: 'noindex' }],
  }),
});

function AdminOrderDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [history, setHistory] = useState<Array<{ status: OrderStatus; created_at: string; changed_by: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const result = await adminGetOrderFn({ data: { accessToken, id } });
      if (!result.ok) {
        toast.error(result.message);
        navigate({ to: '/admin/pedidos' });
        return;
      }
      setOrder(result.order);
      setHistory(result.history);
    } finally {
      setLoading(false);
    }
  }, [accessToken, id, navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleStatusChange = async (status: OrderStatus) => {
    if (!accessToken || !order) return;
    setSaving(true);
    try {
      const result = await adminUpdateOrderStatusFn({
        data: { accessToken, id: order.id, status },
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success('Status atualizado.');
      await load();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Pedido">
        <p className="text-muted-foreground">Carregando…</p>
      </AdminLayout>
    );
  }

  if (!order) return null;

  return (
    <AdminLayout
      title={`Pedido #${shortOrderId(order.id)}`}
      breadcrumb="Pedidos"
      actions={
        <Button asChild variant="outline" size="sm" className="border-gold/40">
          <Link to="/admin/pedidos">Voltar</Link>
        </Button>
      }
    >
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="premium-card rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <OrderStatusBadge status={order.status} />
            <span className="text-gold font-display text-xl">{formatCents(order.total_cents)}</span>
          </div>
          <p className="text-sm">
            <span className="text-muted-foreground">Cliente:</span> {order.customer_email}
          </p>
          <p className="text-sm">
            <span className="text-muted-foreground">Criado:</span> {formatDate(order.created_at)}
          </p>
          {order.payment_provider && (
            <p className="text-sm">
              <span className="text-muted-foreground">Pagamento:</span> {order.payment_provider}
              {order.payment_id && ` · ${order.payment_id}`}
            </p>
          )}
          {order.shipping_name && (
            <div className="text-sm space-y-1 pt-2 border-t border-gold/10">
              <p className="text-muted-foreground">Envio</p>
              <p>{order.shipping_name}</p>
              {order.shipping_phone && <p>{order.shipping_phone}</p>}
              {order.shipping_address && (
                <pre className="text-xs whitespace-pre-wrap text-muted-foreground">
                  {JSON.stringify(order.shipping_address, null, 2)}
                </pre>
              )}
            </div>
          )}

          <div className="space-y-2 pt-2">
            <p className="text-sm text-muted-foreground">Alterar status</p>
            <Select
              value={order.status}
              onValueChange={(v) => handleStatusChange(v as OrderStatus)}
              disabled={saving}
            >
              <SelectTrigger className="border-gold/30">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORDER_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {ORDER_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-6">
          <div className="premium-card rounded-xl p-6 space-y-3">
            <h2 className="font-display text-lg">Itens</h2>
            <ul className="divide-y divide-gold/10">
              {(order.order_items ?? []).map((item) => (
                <li key={item.id} className="py-2 flex justify-between gap-2 text-sm">
                  <span>
                    {item.product_title} × {item.quantity}
                  </span>
                  <span className="text-gold">{formatCents(item.unit_price_cents * item.quantity)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="premium-card rounded-xl p-6 space-y-3">
            <h2 className="font-display text-lg">Histórico</h2>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem histórico.</p>
            ) : (
              <ul className="space-y-2">
                {history.map((h, i) => (
                  <li key={i} className="text-sm flex flex-wrap gap-2 items-center">
                    <OrderStatusBadge status={h.status} />
                    <span className="text-muted-foreground text-xs">{formatDate(h.created_at)}</span>
                    {h.changed_by && (
                      <span className="text-xs text-muted-foreground">· {h.changed_by}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
