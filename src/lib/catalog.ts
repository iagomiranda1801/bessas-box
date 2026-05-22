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

const isServer = typeof window === "undefined";

/** Catálogo: Storefront (privado no SSR, público no cliente) ou Admin API como fallback. */
export async function fetchProductsForStore(first = 24): Promise<ShopifyProduct[]> {
  if (hasStorefrontToken()) {
    try {
      return await fetchProducts(first);
    } catch (error) {
      console.error("Storefront catalog failed:", error);
    }
  }
  if (isServer && hasAdminApiToken()) {
    try {
      return await fetchProductsAdmin(first);
    } catch (error) {
      console.error("Admin API catalog failed:", error);
    }
  }
  return [];
}

export async function fetchProductByHandleForStore(
  handle: string,
): Promise<ShopifyProduct | null> {
  if (hasStorefrontToken()) {
    try {
      return await fetchProductByHandle(handle);
    } catch (error) {
      console.error("Storefront product failed:", error);
    }
  }
  if (isServer && hasAdminApiToken()) {
    try {
      return await fetchProductByHandleAdmin(handle);
    } catch (error) {
      console.error("Admin API product failed:", error);
    }
  }
  return null;
}
