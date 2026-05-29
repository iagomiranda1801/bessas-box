import type { OrderRow } from '@/lib/order-types';
import type { PaymentChargeResult, PaymentProvider, PaymentWebhookResult } from '@/lib/payments/types';

export class AsaasProvider implements PaymentProvider {
  name = 'asaas' as const;

  async createCharge(order: OrderRow): Promise<PaymentChargeResult> {
    const apiKey = process.env.ASAAS_API_KEY?.trim();
    if (!apiKey) {
      return {
        paymentId: `asaas-stub-${order.id}`,
        checkoutUrl: `/checkout/pending?order=${order.id}`,
      };
    }

    // Integração real: POST https://api.asaas.com/v3/payments
    console.warn('AsaasProvider: API key configurada — implemente cobrança Asaas');
    return {
      paymentId: `asaas-pending-${order.id}`,
      checkoutUrl: `/checkout/pending?order=${order.id}`,
    };
  }

  async handleWebhook(payload: unknown): Promise<PaymentWebhookResult | null> {
    const body = payload as { event?: string; payment?: { id?: string; externalReference?: string } };
    if (body.event === 'PAYMENT_RECEIVED' && body.payment?.externalReference) {
      return {
        orderId: body.payment.externalReference,
        status: 'paid',
        paymentId: body.payment.id,
      };
    }
    return null;
  }
}
