import type { OrderRow } from '@/lib/order-types';
import type { PaymentChargeResult, PaymentProvider, PaymentWebhookResult } from '@/lib/payments/types';

export class MercadoPagoProvider implements PaymentProvider {
  name = 'mercadopago' as const;

  async createCharge(order: OrderRow): Promise<PaymentChargeResult> {
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
    if (!token) {
      return {
        paymentId: `mp-stub-${order.id}`,
        checkoutUrl: `/checkout/pending?order=${order.id}`,
      };
    }

    // Integração real: POST https://api.mercadopago.com/checkout/preferences
    console.warn('MercadoPagoProvider: token configurado — implemente preference API');
    return {
      paymentId: `mp-pending-${order.id}`,
      checkoutUrl: `/checkout/pending?order=${order.id}`,
    };
  }

  async handleWebhook(payload: unknown): Promise<PaymentWebhookResult | null> {
    const body = payload as { data?: { id?: string }; type?: string; orderId?: string };
    if (body.type === 'payment' && body.orderId) {
      return { orderId: body.orderId, status: 'paid', paymentId: body.data?.id };
    }
    return null;
  }
}
