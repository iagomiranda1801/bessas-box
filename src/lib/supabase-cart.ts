import type { ShopifyProduct } from '@/lib/shopify';
import { DEFAULT_COLOR, parseVariantId } from '@/lib/product-variants';
import { useSupabaseCartStore } from '@/stores/supabaseCartStore';

/** @deprecated Use parseVariantId from product-variants */
export function parseSupabaseVariantId(variantId: string): string | null {
  return parseVariantId(variantId)?.productId ?? null;
}

export { buildVariantId as supabaseVariantId } from '@/lib/product-variants';

type VariantNode = {
  id: string;
  title: string;
  price: { amount: string; currencyCode: string };
  availableForSale: boolean;
  quantityAvailable: number | null;
  selectedOptions: Array<{ name: string; value: string }>;
};

function formatCartTitle(productTitle: string, color: string, size: string): string {
  const parts = [productTitle];
  if (color && color !== DEFAULT_COLOR) parts.push(color);
  if (size && size !== 'Único') parts.push(size);
  return parts.length > 1 ? parts.join(' — ') : productTitle;
}

export function addProductToSupabaseCart(
  product: ShopifyProduct,
  variant: VariantNode,
): { ok: true } | { ok: false; message: string } {
  if (!variant.availableForSale) {
    return { ok: false, message: 'Produto esgotado.' };
  }

  const parsed = parseVariantId(variant.id);
  const productId = parsed?.productId ?? product.node.id;
  const color =
    parsed?.color ??
    variant.selectedOptions.find((o) => o.name === 'Cor')?.value ??
    DEFAULT_COLOR;
  const size =
    parsed?.size ??
    variant.selectedOptions.find((o) => o.name === 'Tamanho')?.value ??
    variant.title;
  const priceCents = Math.round(parseFloat(variant.price.amount) * 100);

  return useSupabaseCartStore.getState().addItem({
    productId,
    color,
    size,
    slug: product.node.handle,
    title: formatCartTitle(product.node.title, color, size),
    priceCents,
    imageUrl: product.node.images.edges[0]?.node.url ?? null,
    stockQuantity: variant.quantityAvailable ?? 0,
  });
}
