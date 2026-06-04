import type { OrderRow } from '@/lib/order-types';
import type { PaymentChargeResult, PaymentProvider, PaymentWebhookResult } from '@/lib/payments/types';
import {
  findOrCreateCustomer,
  createPayment,
  getPixQrCode,
  isAsaasConfigured,
  type AsaasPixQrCode,
} from '@/lib/payments/asaas-client';
import { cleanCpf } from '@/lib/cpf-utils';

const PAID_EVENTS = new Set(['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED']);
const OVERDUE_EVENTS = new Set(['PAYMENT_OVERDUE', 'PAYMENT_DELETED']);
const REFUND_EVENTS = new Set(['PAYMENT_REFUNDED']);

function orderValueReais(order: OrderRow): number {
  return order.total_cents / 100;
}

export function buildDemoPixCharge(order: Pick<OrderRow, 'id'>): PaymentChargeResult {
  return buildDemoCharge(order as OrderRow);
}

function buildDemoCharge(order: OrderRow): PaymentChargeResult {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  return {
    paymentId: `asaas-stub-${order.id}`,
    checkoutUrl: `/checkout/pagar/${order.id}`,
    pixCopyPaste:
      '00020126580014BR.GOV.BCB.PIX0136demo-bessasbox000520400005303986540510.005802BR5925Bessas Box Demo6009Uberaba62070503***6304DEMO',
    chargePayload: {
      demo: true,
      pixCopyPaste:
        '00020126580014BR.GOV.BCB.PIX0136demo-bessasbox000520400005303986540510.005802BR5925Bessas Box Demo6009Uberaba62070503***6304DEMO',
      expiresAt,
    },
  };
}

export class AsaasProvider implements PaymentProvider {
  name = 'asaas' as const;

  async createCharge(order: OrderRow): Promise<PaymentChargeResult> {
    const checkoutUrl = `/checkout/pagar/${order.id}`;

    if (!isAsaasConfigured()) {
      return buildDemoCharge(order);
    }

    const cpf = order.customer_cpf ? cleanCpf(order.customer_cpf) : '';
    if (!cpf || cpf.length !== 11) {
      throw new Error('CPF inválido para cobrança Asaas.');
    }

    const customer = await findOrCreateCustomer({
      name: order.shipping_name || order.customer_email,
      email: order.customer_email,
      cpfCnpj: cpf,
      phone: order.shipping_phone ?? undefined,
    });

    const payment = await createPayment({
      customerId: customer.id,
      value: orderValueReais(order),
      externalReference: order.id,
      billingType: 'UNDEFINED',
    });

    // Pix inline é conveniência: não pode derrubar a cobrança se o endpoint
    // falhar (ex.: conta sem Pix dinâmico). A página de fatura do Asaas
    // (invoiceUrl) é o destino de pagamento principal.
    let pix: AsaasPixQrCode | null = null;
    try {
      pix = await getPixQrCode(payment.id);
    } catch (error) {
      console.warn('[asaas] Pix QR indisponível, usando invoiceUrl:', error);
    }

    return {
      paymentId: payment.id,
      checkoutUrl,
      pixQrCode: pix?.encodedImage,
      pixCopyPaste: pix?.payload,
      chargePayload: {
        pixQrCode: pix?.encodedImage,
        pixCopyPaste: pix?.payload,
        invoiceUrl: payment.invoiceUrl,
        expiresAt: pix?.expirationDate,
      },
    };
  }

  async handleWebhook(payload: unknown, headers?: Headers): Promise<PaymentWebhookResult | null> {
    const webhookToken = process.env.ASAAS_WEBHOOK_TOKEN?.trim();
    if (!webhookToken) {
      console.warn('[asaas] ASAAS_WEBHOOK_TOKEN ausente; webhook recusado');
      return null;
    }

    const received = headers?.get('asaas-access-token');
    if (received !== webhookToken) {
      console.warn('[asaas] Webhook token invalido');
      return null;
    }

    const body = payload as {
      event?: string;
      payment?: { id?: string; externalReference?: string };
    };

    if (!body.event || !body.payment?.externalReference) return null;

    const base = {
      orderId: body.payment.externalReference,
      paymentId: body.payment.id,
    };

    if (PAID_EVENTS.has(body.event)) {
      return {
        ...base,
        chargeStatus: body.event === 'PAYMENT_CONFIRMED' ? 'confirmed' : 'received',
        orderStatus: 'paid',
      };
    }

    if (REFUND_EVENTS.has(body.event)) {
      return { ...base, chargeStatus: 'refunded', orderStatus: 'refunded' };
    }

    if (OVERDUE_EVENTS.has(body.event)) {
      return {
        ...base,
        chargeStatus: body.event === 'PAYMENT_OVERDUE' ? 'overdue' : 'cancelled',
        orderStatus: 'cancelled',
      };
    }

    return null;
  }
}

export { getAsaasDashboardUrl } from '@/lib/payments/asaas-client';
