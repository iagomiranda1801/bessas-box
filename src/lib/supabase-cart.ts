import type { ShopifyProduct } from '@/lib/shopify';
import { parseVariantId } from '@/lib/product-sizes';
import { useSupabaseCartStore } from '@/stores/supabaseCartStore';

/** @deprecated Use parseVariantId from product-sizes */
export function parseSupabaseVariantId(variantId: string): string | null {
  return parseVariantId(variantId)?.productId ?? null;
}

export { buildVariantId as supabaseVariantId } from '@/lib/product-sizes';

type VariantNode = {
  id: string;
  title: string;
  price: { amount: string; currencyCode: string };
  availableForSale: boolean;
  quantityAvailable: number | null;
  selectedOptions: Array<{ name: string; value: string }>;
};

export function addProductToSupabaseCart(
  product: ShopifyProduct,
  variant: VariantNode,
): { ok: true } | { ok: false; message: string } {
  if (!variant.availableForSale) {
    return { ok: false, message: 'Produto esgotado.' };
  }

  const parsed = parseVariantId(variant.id);
  const productId = parsed?.productId ?? product.node.id;
  const size =
    parsed?.size ??
    variant.selectedOptions.find((o) => o.name === 'Tamanho')?.value ??
    variant.title;
  const priceCents = Math.round(parseFloat(variant.price.amount) * 100);
  const displayTitle =
    size && size !== 'Default Title' ? `${product.node.title} — ${size}` : product.node.title;

  return useSupabaseCartStore.getState().addItem({
    productId,
    size,
    slug: product.node.handle,
    title: displayTitle,
    priceCents,
    imageUrl: product.node.images.edges[0]?.node.url ?? null,
    stockQuantity: variant.quantityAvailable ?? 0,
  });
}
