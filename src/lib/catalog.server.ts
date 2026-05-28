import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  fetchProducts,
  fetchProductByHandle,
  hasStorefrontToken,
  type ShopifyProduct,
} from "@/lib/shopify";
import {
  fetchProductsAdmin,
  fetchProductByHandleAdmin,
  hasAdminApiToken,
} from "@/lib/shopify-admin";

/** Catálogo via Storefront (token privado) ou Admin API — só no servidor. */
export async function fetchProductsServer(first = 24): Promise<ShopifyProduct[]> {
  if (hasStorefrontToken()) {
    try {
      return await fetchProducts(first);
    } catch (error) {
      console.error("Storefront catalog failed:", error);
    }
  }
  if (hasAdminApiToken()) {
    try {
      return await fetchProductsAdmin(first);
    } catch (error) {
      console.error("Admin API catalog failed:", error);
    }
  }
  return [];
}

export async function fetchProductByHandleServer(
  handle: string,
): Promise<ShopifyProduct | null> {
  if (hasStorefrontToken()) {
    try {
      return await fetchProductByHandle(handle);
    } catch (error) {
      console.error("Storefront product failed:", error);
    }
  }
  if (hasAdminApiToken()) {
    try {
      return await fetchProductByHandleAdmin(handle);
    } catch (error) {
      console.error("Admin API product failed:", error);
    }
  }
  return null;
}

const firstSchema = z.object({ first: z.number().int().positive().max(100).optional() });

export const catalogProductsFn = createServerFn({ method: "POST" })
  .inputValidator(firstSchema)
  .handler(async ({ data }) => fetchProductsServer(data.first ?? 24));

const handleSchema = z.object({ handle: z.string().min(1) });

export const catalogProductByHandleFn = createServerFn({ method: "POST" })
  .inputValidator(handleSchema)
  .handler(async ({ data }) => fetchProductByHandleServer(data.handle));
