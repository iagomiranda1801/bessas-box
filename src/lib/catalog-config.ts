export type CatalogSource = 'supabase';

export function getCatalogSource(): CatalogSource {
  return 'supabase';
}

export function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS?.trim() ?? '';
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function slugifyTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export type CartSource = 'supabase';
export type PaymentProviderName = 'mercadopago' | 'asaas';

export function getCartSource(): CartSource {
  return 'supabase';
}

export function getPaymentProvider(): PaymentProviderName {
  const raw = process.env.PAYMENT_PROVIDER?.trim().toLowerCase() ?? 'mercadopago';
  return raw === 'asaas' ? 'asaas' : 'mercadopago';
}

export function maskAdminEmails(): string {
  return getAdminEmails()
    .map((e) => {
      const [local, domain] = e.split('@');
      if (!domain) return e;
      return `${local.slice(0, 2)}***@${domain}`;
    })
    .join(', ');
}
