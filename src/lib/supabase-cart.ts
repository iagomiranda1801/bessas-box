import type { ShopifyProduct } from '@/lib/shopify';
import { useSupabaseCartStore } from '@/stores/supabaseCartStore';

export function parseSupabaseVariantId(variantId: string): string | null {
  if (!variantId.startsWith('supabase-variant-')) return null;
  return variantId.replace('supabase-variant-', '');
}

export function supabaseVariantId(productId: string): string {
  return `supabase-variant-${productId}`;
}

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

  const productId = parseSupabaseVariantId(variant.id) ?? product.node.id;
  const priceCents = Math.round(parseFloat(variant.price.amount) * 100);

  return useSupabaseCartStore.getState().addItem({
    productId,
    slug: product.node.handle,
    title: product.node.title,
    priceCents,
    imageUrl: product.node.images.edges[0]?.node.url ?? null,
    stockQuantity: variant.quantityAvailable ?? 99,
  });
}
