import type { OrderRow } from '@/lib/order-types';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { buildDemoPixCharge } from '@/lib/payments/asaas.provider';
import type { PaymentChargeResult, PaymentProvider, PaymentWebhookResult } from '@/lib/payments/types';

function parseSignatureHeader(value: string | null): { ts: string; v1: string } | null {
  if (!value) return null;
  const parts = Object.fromEntries(
    value.split(',').map((part) => {
      const [key, ...rest] = part.trim().split('=');
      return [key, rest.join('=')];
    }),
  );
  if (!parts.ts || !parts.v1) return null;
  return { ts: parts.ts, v1: parts.v1 };
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const left = Buffer.from(a, 'hex');
    const right = Buffer.from(b, 'hex');
    return left.length === right.length && timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

function verifyMercadoPagoSignature(payload: unknown, headers?: Headers): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim();
  if (!secret) {
    console.warn('[mercadopago] MERCADOPAGO_WEBHOOK_SECRET ausente; webhook recusado');
    return false;
  }

  const parsed = parseSignatureHeader(headers?.get('x-signature') ?? null);
  const requestId = headers?.get('x-request-id');
  const dataId = (payload as { data?: { id?: string } })?.data?.id;
  if (!parsed || !requestId || !dataId) return false;

  const manifest = `id:${dataId};request-id:${requestId};ts:${parsed.ts};`;
  const expected = createHmac('sha256', secret).update(manifest).digest('hex');
  return safeEqualHex(expected, parsed.v1);
}

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

  async handleWebhook(payload: unknown, headers?: Headers): Promise<PaymentWebhookResult | null> {
    if (!verifyMercadoPagoSignature(payload, headers)) {
      console.warn('[mercadopago] Webhook com assinatura invalida');
      return null;
    }

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
