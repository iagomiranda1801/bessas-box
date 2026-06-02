export const PAYMENT_CHARGE_STATUSES = [
  'pending',
  'received',
  'confirmed',
  'overdue',
  'cancelled',
  'refunded',
] as const;

export type PaymentChargeStatus = (typeof PAYMENT_CHARGE_STATUSES)[number];

export const PAYMENT_CHARGE_STATUS_LABELS: Record<PaymentChargeStatus, string> = {
  pending: 'Pix pendente',
  received: 'Pix recebido',
  confirmed: 'Pix confirmado',
  overdue: 'Pix expirado',
  cancelled: 'Cancelada',
  refunded: 'Reembolsada',
};

export type PaymentChargeRow = {
  id: string;
  order_id: string;
  provider: string;
  external_id: string;
  billing_type: string;
  amount_cents: number;
  status: PaymentChargeStatus;
  pix_qr_code: string | null;
  pix_copy_paste: string | null;
  invoice_url: string | null;
  expires_at: string | null;
  paid_at: string | null;
  customer_cpf: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};
