export type CatalogSource = 'supabase' | 'shopify';

export function getCatalogSource(): CatalogSource {
  const explicit = process.env.CATALOG_SOURCE?.trim().toLowerCase();
  if (explicit === 'shopify') return 'shopify';
  if (explicit === 'supabase') return 'supabase';

  const url =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
    process.env.VITE_SUPABASE_URL ||
    '';
  return url ? 'supabase' : 'shopify';
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

export type CartSource = 'supabase' | 'shopify';
export type PaymentProviderName = 'mercadopago' | 'asaas';

export function getCartSource(): CartSource {
  const explicit =
    process.env.CART_SOURCE?.trim().toLowerCase() ??
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CART_SOURCE
      ? String(import.meta.env.VITE_CART_SOURCE).toLowerCase()
      : undefined);
  if (explicit === 'shopify') return 'shopify';
  if (explicit === 'supabase') return 'supabase';
  return getCatalogSource() === 'supabase' ? 'supabase' : 'shopify';
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
