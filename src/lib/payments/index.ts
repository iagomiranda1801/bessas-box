import { getPaymentProvider } from '@/lib/catalog-config';
import { AsaasProvider } from '@/lib/payments/asaas.provider';
import { MercadoPagoProvider } from '@/lib/payments/mercadopago.provider';
import type { PaymentProvider } from '@/lib/payments/types';

let cached: PaymentProvider | null = null;

export function getPaymentProviderInstance(): PaymentProvider {
  if (cached) return cached;
  cached = getPaymentProvider() === 'asaas' ? new AsaasProvider() : new MercadoPagoProvider();
  return cached;
}

export type { PaymentChargeResult, PaymentWebhookResult } from '@/lib/payments/types';
