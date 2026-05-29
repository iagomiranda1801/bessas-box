import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { getCatalogSource } from '@/lib/catalog-config';
import { storeProductsToShopifyShape } from '@/lib/catalog-adapter';
import {
  fetchProductBySlugFromSupabase,
  fetchProductsFromSupabase,
} from '@/lib/supabase-catalog';
import {
  fetchProducts,
  fetchProductByHandle,
  hasStorefrontToken,
  type ShopifyProduct,
} from '@/lib/shopify';
import {
  fetchProductsAdmin,
  fetchProductByHandleAdmin,
  hasAdminApiToken,
} from '@/lib/shopify-admin';

async function fetchShopifyProductsServer(first = 24): Promise<ShopifyProduct[]> {
  if (hasStorefrontToken()) {
    try {
      return await fetchProducts(first);
    } catch (error) {
      console.error('Storefront catalog failed:', error);
    }
  }
  if (hasAdminApiToken()) {
    try {
      return await fetchProductsAdmin(first);
    } catch (error) {
      console.error('Admin API catalog failed:', error);
    }
  }
  return [];
}

async function fetchShopifyProductByHandleServer(handle: string): Promise<ShopifyProduct | null> {
  if (hasStorefrontToken()) {
    try {
      return await fetchProductByHandle(handle);
    } catch (error) {
      console.error('Storefront product failed:', error);
    }
  }
  if (hasAdminApiToken()) {
    try {
      return await fetchProductByHandleAdmin(handle);
    } catch (error) {
      console.error('Admin API product failed:', error);
    }
  }
  return null;
}

export async function fetchProductsServer(
  first = 24,
  options?: { featuredOnly?: boolean },
): Promise<ShopifyProduct[]> {
  if (getCatalogSource() === 'supabase') {
    const products = await fetchProductsFromSupabase({
      limit: first,
      featuredOnly: options?.featuredOnly,
    });
    return storeProductsToShopifyShape(products);
  }
  const all = await fetchShopifyProductsServer(first);
  if (options?.featuredOnly) return all.slice(0, Math.min(4, all.length));
  return all;
}

export async function fetchProductByHandleServer(
  handle: string,
): Promise<ShopifyProduct | null> {
  if (getCatalogSource() === 'supabase') {
    const product = await fetchProductBySlugFromSupabase(handle);
    return product ? storeProductsToShopifyShape([product])[0] : null;
  }
  return fetchShopifyProductByHandleServer(handle);
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
