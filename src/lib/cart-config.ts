import { getCatalogSource } from '@/lib/catalog-config';

export type CartSource = 'supabase' | 'shopify';

/** Client-safe cart source (uses VITE_CART_SOURCE or falls back to catalog source). */
export function getClientCartSource(): CartSource {
  const explicit =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_CART_SOURCE
      ? String(import.meta.env.VITE_CART_SOURCE).toLowerCase()
      : undefined;
  if (explicit === 'shopify') return 'shopify';
  if (explicit === 'supabase') return 'supabase';
  return getCatalogSource() === 'supabase' ? 'supabase' : 'shopify';
}

export function isSupabaseCart(): boolean {
  return getClientCartSource() === 'supabase';
}
