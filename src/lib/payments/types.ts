import type { OrderRow } from '@/lib/order-types';

export type PaymentChargeResult = {
  paymentId: string;
  checkoutUrl?: string;
  pixQrCode?: string;
  pixCopyPaste?: string;
};

export type PaymentWebhookResult = {
  orderId: string;
  status: 'paid' | 'failed' | 'cancelled';
  paymentId?: string;
};

export interface PaymentProvider {
  name: 'mercadopago' | 'asaas';
  createCharge(order: OrderRow): Promise<PaymentChargeResult>;
  handleWebhook(payload: unknown, headers?: Headers): Promise<PaymentWebhookResult | null>;
}
