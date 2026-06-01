import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { OrderStatusBadge } from '@/components/admin/OrderStatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { adminGetOrderFn, adminUpdateOrderStatusFn } from '@/lib/orders.server';
import { updateShipmentFn } from '@/lib/shipping.server';
import { getCorreiosTrackingUrl, validateTrackingCode } from '@/lib/shipping/correios-service';
import { formatCents, formatDate, shortOrderId } from '@/lib/admin-utils';
import { ORDER_STATUSES, ORDER_STATUS_LABELS, type OrderRow, type OrderStatus } from '@/lib/order-types';
import { useAdminAuthStore } from '@/stores/adminAuthStore';

export const Route = createFileRoute('/admin/pedidos/$id')({
  params: {
    parse: (params) => ({
      id: z.string().uuid().parse(params.id),
    }),
    stringify: ({ id }) => ({ id }),
  },
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
  const [trackingCode, setTrackingCode] = useState('');
  const [carrierService, setCarrierService] = useState('');
  const [estimatedDelivery, setEstimatedDelivery] = useState('');

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
      
      // Preencher dados de envio se já existirem
      const shipment = result.order.shipments?.[0];
      if (shipment) {
        setTrackingCode(shipment.tracking_code || '');
        setCarrierService(shipment.carrier_service || '');
        setEstimatedDelivery(shipment.estimated_delivery_date || '');
      }
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

  const handleShipmentUpdate = async () => {
    if (!accessToken || !order || !trackingCode.trim()) return;
    
    setSaving(true);
    try {
      const result = await updateShipmentFn({
        data: {
          accessToken,
          orderId: order.id,
          trackingCode: trackingCode.trim(),
          carrierService: carrierService || 'correios',
          estimatedDeliveryDate: estimatedDelivery || undefined,
        },
      });
      
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      
      toast.success('Código de rastreamento adicionado.');
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
            <div className="text-sm space-y-2 pt-3 border-t border-gold/10">
              <p className="text-muted-foreground font-medium">Dados de Entrega</p>
              <div className="space-y-1">
                <p><strong>Nome:</strong> {order.shipping_name}</p>
                {order.shipping_phone && <p><strong>Telefone:</strong> {order.shipping_phone}</p>}
                {order.shipping_cep && <p><strong>CEP:</strong> {order.shipping_cep}</p>}
                {order.shipping_city && order.shipping_state && (
                  <p><strong>Cidade:</strong> {order.shipping_city}, {order.shipping_state}</p>
                )}
                {order.is_local_delivery && (
                  <p className="text-gold text-xs">📍 Entrega local (Uberaba)</p>
                )}
                {order.shipping_cost_cents && order.shipping_cost_cents > 0 && (
                  <p><strong>Custo do frete:</strong> {formatCents(order.shipping_cost_cents)}</p>
                )}
              </div>
              {order.shipping_address && (
                <details className="mt-2">
                  <summary className="text-xs text-muted-foreground cursor-pointer">Endereço completo</summary>
                  <pre className="text-xs whitespace-pre-wrap text-muted-foreground mt-1">
                    {JSON.stringify(order.shipping_address, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}

          {/* Seção de Rastreamento */}
          {order.shipments && order.shipments.length > 0 ? (
            <div className="text-sm space-y-2 pt-3 border-t border-gold/10">
              <p className="text-muted-foreground font-medium">Envio</p>
              {order.shipments.map((shipment) => (
                <div key={shipment.id} className="space-y-1 p-2 bg-gold/5 rounded">
                  <p><strong>Método:</strong> {shipment.shipping_method === 'uber_local' ? 'Uber Connect' : 'Correios'}</p>
                  {shipment.carrier_service && (
                    <p><strong>Serviço:</strong> {shipment.carrier_service}</p>
                  )}
                  {shipment.tracking_code && (
                    <div>
                      <p><strong>Código:</strong> {shipment.tracking_code}</p>
                      {shipment.external_tracking_url && (
                        <a
                          href={shipment.external_tracking_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gold hover:underline text-xs"
                        >
                          Rastrear online ↗
                        </a>
                      )}
                    </div>
                  )}
                  <p><strong>Status:</strong> {shipment.status}</p>
                  {shipment.estimated_delivery_date && (
                    <p><strong>Previsão:</strong> {new Date(shipment.estimated_delivery_date).toLocaleDateString('pt-BR')}</p>
                  )}
                </div>
              ))}
            </div>
          ) : order.status === 'paid' || order.status === 'processing' ? (
            <div className="text-sm space-y-3 pt-3 border-t border-gold/10">
              <p className="text-muted-foreground font-medium">Adicionar Rastreamento</p>
              <div className="space-y-2">
                <Input
                  placeholder="Código de rastreamento"
                  value={trackingCode}
                  onChange={(e) => setTrackingCode(e.target.value.toUpperCase())}
                  className="border-gold/30 text-sm"
                />
                <div className="flex gap-2">
                  <select
                    value={carrierService}
                    onChange={(e) => setCarrierService(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gold/30 rounded text-sm bg-background"
                  >
                    <option value="">Selecionar serviço</option>
                    <option value="PAC">PAC</option>
                    <option value="SEDEX">SEDEX</option>
                    <option value="uber_connect">Uber Connect</option>
                  </select>
                  <Input
                    type="date"
                    placeholder="Previsão de entrega"
                    value={estimatedDelivery}
                    onChange={(e) => setEstimatedDelivery(e.target.value)}
                    className="border-gold/30 text-sm"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleShipmentUpdate}
                  disabled={saving || !trackingCode.trim()}
                  className="bg-gold text-onyx hover:bg-gold-soft w-full"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Marcar como Enviado'
                  )}
                </Button>
              </div>
            </div>
          ) : null}

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
