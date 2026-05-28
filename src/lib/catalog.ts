import type { ShopifyProduct } from "@/lib/shopify";
import {
  catalogProductByHandleFn,
  catalogProductsFn,
  fetchProductByHandleServer,
  fetchProductsServer,
} from "@/lib/catalog.server";

const isServer = typeof window === "undefined";

/** Catálogo: SSR direto no servidor; no navegador usa server function (token privado). */
export async function fetchProductsForStore(first = 24): Promise<ShopifyProduct[]> {
  if (isServer) {
    return fetchProductsServer(first);
  }
  try {
    return await catalogProductsFn({ data: { first } });
  } catch (error) {
    console.error("Catalog RPC failed:", error);
    return [];
  }
}

export async function fetchProductByHandleForStore(
  handle: string,
): Promise<ShopifyProduct | null> {
  if (isServer) {
    return fetchProductByHandleServer(handle);
  }
  try {
    return await catalogProductByHandleFn({ data: { handle } });
  } catch (error) {
    console.error("Product RPC failed:", error);
    return null;
  }
}
