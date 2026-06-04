import type { PaymentChargeRow } from '@/lib/payment-charge-types';

export const ORDER_STATUSES = [
  'pending',
  'awaiting_payment',
  'paid',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pendente',
  awaiting_payment: 'Aguardando pagamento',
  paid: 'Pago',
  processing: 'Em processamento',
  shipped: 'Enviado',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
};

export const SHIPMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Preparando',
  shipped: 'Enviado',
  in_transit: 'Em trânsito',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};

export type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_title: string;
  quantity: number;
  unit_price_cents: number;
  size?: string | null;
  created_at: string;
};

export type OrderRow = {
  id: string;
  user_id: string | null;
  customer_email: string;
  status: OrderStatus;
  total_cents: number;
  currency: string;
  payment_provider: string | null;
  payment_id: string | null;
  shipping_name: string | null;
  shipping_phone: string | null;
  shipping_address: Record<string, unknown> | null;
  shipping_cep: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  is_local_delivery: boolean | null;
  shipping_cost_cents: number | null;
  customer_cpf: string | null;
  notes: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  order_items?: OrderItemRow[];
  payment_charges?: PaymentChargeRow[];
  shipments?: Array<{
    id: string;
    shipping_method: string;
    carrier_service?: string;
    tracking_code?: string;
    status: string;
    estimated_delivery_date?: string;
    external_tracking_url?: string;
  }>;
};

export type OrderStatusHistoryRow = {
  id: string;
  order_id: string;
  status: OrderStatus;
  changed_by: string | null;
  created_at: string;
};

export type AdminCustomerRow = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  created_at: string;
  order_count: number;
};
