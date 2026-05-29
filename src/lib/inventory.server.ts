import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import type { VariantStock } from '@/lib/inventory';
import { parseSupabaseVariantId } from '@/lib/supabase-cart';
import { getSupabaseAnonServerClient } from '@/lib/supabase-server';

export async function fetchVariantStock(variantId: string): Promise<VariantStock | null> {
  const productId = parseSupabaseVariantId(variantId);
  if (!productId) return null;

  const client = getSupabaseAnonServerClient();
  const { data, error } = await client
    .from('products')
    .select('stock_quantity, is_active')
    .eq('id', productId)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) return null;

  return {
    availableForSale: data.stock_quantity > 0,
    quantityAvailable: data.stock_quantity,
  };
}

export const variantStockFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ variantId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const stock = await fetchVariantStock(data.variantId);
    if (!stock) return { ok: false as const, stock: null };
    return { ok: true as const, stock };
  });
