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

export type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_title: string;
  quantity: number;
  unit_price_cents: number;
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
  notes: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  order_items?: OrderItemRow[];
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
