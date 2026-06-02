import type { OrderRow } from '@/lib/order-types';
import type { PaymentChargeStatus } from '@/lib/payment-charge-types';

export type PaymentChargePayload = {
  pixQrCode?: string;
  pixCopyPaste?: string;
  invoiceUrl?: string;
  expiresAt?: string;
  demo?: boolean;
};

export type PaymentChargeResult = {
  paymentId: string;
  checkoutUrl?: string;
  pixQrCode?: string;
  pixCopyPaste?: string;
  chargePayload?: PaymentChargePayload;
};

export type PaymentWebhookResult = {
  orderId: string;
  paymentId?: string;
  chargeStatus: PaymentChargeStatus;
  orderStatus?: 'paid' | 'cancelled' | 'refunded' | null;
};

export interface PaymentProvider {
  name: 'mercadopago' | 'asaas';
  createCharge(order: OrderRow): Promise<PaymentChargeResult>;
  handleWebhook(payload: unknown, headers?: Headers): Promise<PaymentWebhookResult | null>;
}
