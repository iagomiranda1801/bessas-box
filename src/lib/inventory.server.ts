import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { storefrontApiRequest } from '@/lib/shopify';
import type { VariantStock } from '@/lib/inventory';

const VARIANT_INVENTORY_QUERY = `
  query VariantInventory($id: ID!) {
    node(id: $id) {
      ... on ProductVariant {
        id
        availableForSale
        quantityAvailable
      }
    }
  }
`;

export async function fetchVariantStock(variantId: string): Promise<VariantStock | null> {
  const data = await storefrontApiRequest(VARIANT_INVENTORY_QUERY, { id: variantId });
  const node = data?.data?.node;
  if (!node?.id) return null;
  return {
    availableForSale: Boolean(node.availableForSale),
    quantityAvailable:
      typeof node.quantityAvailable === 'number' ? node.quantityAvailable : null,
  };
}

export const variantStockFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ variantId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const stock = await fetchVariantStock(data.variantId);
    if (!stock) return { ok: false as const, stock: null };
    return { ok: true as const, stock };
  });
