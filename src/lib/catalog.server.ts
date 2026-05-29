import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { storeProductsToShopifyShape } from '@/lib/catalog-adapter';
import {
  fetchProductBySlugFromSupabase,
  fetchProductsFromSupabase,
} from '@/lib/supabase-catalog';
import type { ShopifyProduct } from '@/lib/shopify';

export async function fetchProductsServer(
  first = 24,
  options?: { featuredOnly?: boolean },
): Promise<ShopifyProduct[]> {
  const products = await fetchProductsFromSupabase({
    limit: first,
    featuredOnly: options?.featuredOnly,
  });
  return storeProductsToShopifyShape(products);
}

export async function fetchProductByHandleServer(
  handle: string,
): Promise<ShopifyProduct | null> {
  const product = await fetchProductBySlugFromSupabase(handle);
  return product ? storeProductsToShopifyShape([product])[0] : null;
}

const firstSchema = z.object({
  first: z.number().int().positive().max(100).optional(),
  featuredOnly: z.boolean().optional(),
});

export const catalogProductsFn = createServerFn({ method: 'POST' })
  .inputValidator(firstSchema)
  .handler(async ({ data }) =>
    fetchProductsServer(data.first ?? 24, { featuredOnly: data.featuredOnly }),
  );

const handleSchema = z.object({ handle: z.string().min(1) });

export const catalogProductByHandleFn = createServerFn({ method: 'POST' })
  .inputValidator(handleSchema)
  .handler(async ({ data }) => fetchProductByHandleServer(data.handle));
