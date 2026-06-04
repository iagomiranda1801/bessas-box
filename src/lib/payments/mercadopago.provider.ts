import type { OrderRow } from '@/lib/order-types';
import { buildDemoPixCharge } from '@/lib/payments/asaas.provider';
import type { PaymentChargeResult, PaymentProvider, PaymentWebhookResult } from '@/lib/payments/types';

export class MercadoPagoProvider implements PaymentProvider {
  name = 'mercadopago' as const;

  async createCharge(order: OrderRow): Promise<PaymentChargeResult> {
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
    if (!token) {
      const demo = buildDemoPixCharge(order);
      return {
        ...demo,
        paymentId: `mp-stub-${order.id}`,
        checkoutUrl: `/checkout/pagar/${order.id}`,
      };
    }

    // Integração real: POST https://api.mercadopago.com/checkout/preferences
    console.warn('MercadoPagoProvider: token configurado — implemente preference API');
    const demo = buildDemoPixCharge(order);
    return {
      ...demo,
      paymentId: `mp-pending-${order.id}`,
      checkoutUrl: `/checkout/pagar/${order.id}`,
    };
  }

  async handleWebhook(payload: unknown, _headers?: Headers): Promise<PaymentWebhookResult | null> {
    const body = payload as { data?: { id?: string }; type?: string; orderId?: string };
    if (body.type === 'payment' && body.orderId) {
      return {
        orderId: body.orderId,
        paymentId: body.data?.id,
        chargeStatus: 'confirmed',
        orderStatus: 'paid',
      };
    }
    return null;
  }
}
