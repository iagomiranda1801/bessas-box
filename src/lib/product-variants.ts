import {
  emptySizeStock,
  getSizesForProfile,
  normalizeSizeStock,
  sumSizeStock,
  type ProductCategory,
  type SizeProfile,
  type SizeStock,
} from '@/lib/product-sizes';

export const DEFAULT_COLOR = 'Padrão';

export type VariantStock = Record<string, Record<string, number>>;

export const SUGGESTED_COLORS_BY_CATEGORY: Record<ProductCategory, readonly string[]> = {
  camiseta: ['Preto', 'Branco', 'Cinza', 'Azul', 'Verde', 'Bege'],
  polo: ['Preto', 'Branco', 'Azul marinho', 'Cinza', 'Verde'],
  shorts: ['Preto', 'Branco', 'Cinza', 'Azul', 'Verde'],
  tenis: ['Preto', 'Branco', 'Cinza'],
  calca_jeans: ['Azul escuro', 'Azul claro', 'Preto', 'Cinza'],
  bone: ['Preto', 'Branco', 'Verde', 'Azul'],
};

export const COLOR_SWATCH_HEX: Record<string, string> = {
  Preto: '#1a1a1a',
  Branco: '#f5f5f5',
  Cinza: '#9ca3af',
  Azul: '#2563eb',
  'Azul marinho': '#1e3a5f',
  'Azul escuro': '#1e40af',
  'Azul claro': '#60a5fa',
  Verde: '#16a34a',
  Bege: '#d4c4a8',
  Padrão: '#a8a29e',
};

const VARIANT_PREFIX = 'supabase-variant-';
const VARIANT_SEPARATOR = '--';

export function getSuggestedColorsForCategory(category: ProductCategory): readonly string[] {
  return SUGGESTED_COLORS_BY_CATEGORY[category] ?? SUGGESTED_COLORS_BY_CATEGORY.camiseta;
}

export function emptyVariantStock(
  profile: SizeProfile,
  colors: readonly string[],
): VariantStock {
  const sizes = getSizesForProfile(profile);
  return Object.fromEntries(
    colors.map((color) => [
      color,
      Object.fromEntries(sizes.map((size) => [size, 0])),
    ]),
  );
}

export function normalizeVariantStock(
  profile: SizeProfile,
  colors: readonly string[],
  raw: VariantStock | null | undefined,
): VariantStock {
  const normalized = emptyVariantStock(profile, colors);
  if (!raw || typeof raw !== 'object') return normalized;
  const sizes = getSizesForProfile(profile);
  for (const color of colors) {
    const row = raw[color];
    if (!row || typeof row !== 'object') continue;
    for (const size of sizes) {
      const qty = row[size];
      if (typeof qty === 'number' && qty >= 0) {
        normalized[color]![size] = Math.floor(qty);
      }
    }
  }
  return normalized;
}

export function sumVariantStock(variantStock: VariantStock | null | undefined): number {
  if (!variantStock || typeof variantStock !== 'object') return 0;
  return Object.values(variantStock).reduce(
    (sum, row) =>
      sum +
      Object.values(row ?? {}).reduce((s, qty) => s + (Number(qty) || 0), 0),
    0,
  );
}

export function flattenToSizeStock(
  profile: SizeProfile,
  variantStock: VariantStock,
): SizeStock {
  const sizes = getSizesForProfile(profile);
  const flat = emptySizeStock(profile);
  for (const size of sizes) {
    let total = 0;
    for (const row of Object.values(variantStock)) {
      total += Number(row?.[size]) || 0;
    }
    flat[size] = total;
  }
  return flat;
}

export function variantStockFromLegacySizeStock(
  profile: SizeProfile,
  colors: readonly string[],
  sizeStock: SizeStock | null | undefined,
): VariantStock {
  const normalized = normalizeSizeStock(profile, sizeStock);
  const primary = colors[0] ?? DEFAULT_COLOR;
  return { [primary]: normalized };
}

export function resolveProductColors(
  raw: string[] | null | undefined,
): string[] {
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((c) => c.trim()).filter(Boolean);
  }
  return [DEFAULT_COLOR];
}

export function resolveVariantStock(
  profile: SizeProfile,
  colors: string[],
  variantStock: VariantStock | null | undefined,
  sizeStock: SizeStock | null | undefined,
  stockQuantity?: number,
): VariantStock {
  if (variantStock && typeof variantStock === 'object' && Object.keys(variantStock).length > 0) {
    const normalized = normalizeVariantStock(profile, colors, variantStock);
    const hasLegacySizeStock =
      sizeStock &&
      typeof sizeStock === 'object' &&
      Object.keys(sizeStock).length > 0;
    // Migração: variant_stock só com "Padrão" mas product_colors já atualizado → usa size_stock
    if (sumVariantStock(normalized) === 0 && hasLegacySizeStock) {
      return variantStockFromLegacySizeStock(profile, colors, sizeStock);
    }
    return normalized;
  }
  if (sizeStock && typeof sizeStock === 'object' && Object.keys(sizeStock).length > 0) {
    return variantStockFromLegacySizeStock(profile, colors, sizeStock);
  }
  const empty = emptyVariantStock(profile, colors);
  const sizes = getSizesForProfile(profile);
  if (sizes.length > 0 && (stockQuantity ?? 0) > 0) {
    empty[colors[0]!]![sizes[0]!] = stockQuantity ?? 0;
  }
  return empty;
}

export function stockForVariant(
  variantStock: VariantStock | null | undefined,
  sizeStock: SizeStock | null | undefined,
  stockQuantity: number,
  color: string,
  size: string,
): number {
  if (variantStock && typeof variantStock === 'object' && Object.keys(variantStock).length > 0) {
    const qty = variantStock[color]?.[size];
    if (typeof qty === 'number') return qty;
  }
  if (sizeStock && typeof sizeStock === 'object') {
    const qty = sizeStock[size];
    if (typeof qty === 'number') return qty;
  }
  return stockQuantity;
}

/** Mesma lógica do catálogo — evita checkout divergir da loja. */
export function availableStockForProduct(
  product: {
    size_profile?: SizeProfile | string | null;
    product_colors?: string[] | null;
    variant_stock?: VariantStock | null;
    size_stock?: SizeStock | null;
    stock_quantity: number;
  },
  color: string,
  size: string,
): number {
  const validProfiles: SizeProfile[] = ['apparel', 'shoe', 'jeans', 'one_size'];
  const profile =
    product.size_profile && validProfiles.includes(product.size_profile as SizeProfile)
      ? (product.size_profile as SizeProfile)
      : 'apparel';
  const colors = resolveProductColors(product.product_colors);
  const resolved = resolveVariantStock(
    profile,
    colors,
    product.variant_stock,
    product.size_stock,
    product.stock_quantity,
  );
  return resolved[color]?.[size] ?? 0;
}

export function buildVariantId(productId: string, color: string, size: string): string {
  return `${VARIANT_PREFIX}${productId}${VARIANT_SEPARATOR}${encodeURIComponent(color)}${VARIANT_SEPARATOR}${encodeURIComponent(size)}`;
}

export function parseVariantId(
  variantId: string,
): { productId: string; color: string; size: string } | null {
  if (!variantId.startsWith(VARIANT_PREFIX)) return null;
  const rest = variantId.slice(VARIANT_PREFIX.length);
  const firstSep = rest.indexOf(VARIANT_SEPARATOR);
  if (firstSep === -1) {
    const sizes = getSizesForProfile('apparel');
    return { productId: rest, color: DEFAULT_COLOR, size: sizes[0] ?? 'M' };
  }
  const productId = rest.slice(0, firstSep);
  const tail = rest.slice(firstSep + VARIANT_SEPARATOR.length);
  const secondSep = tail.indexOf(VARIANT_SEPARATOR);
  if (secondSep === -1) {
    return {
      productId,
      color: DEFAULT_COLOR,
      size: decodeURIComponent(tail),
    };
  }
  return {
    productId,
    color: decodeURIComponent(tail.slice(0, secondSep)),
    size: decodeURIComponent(tail.slice(secondSep + VARIANT_SEPARATOR.length)),
  };
}

export function cartLineKey(productId: string, color: string, size: string): string {
  return `${productId}::${color}::${size}`;
}

export function formatVariantLabel(
  color: string,
  size: string,
  options?: { colorCount?: number; sizeCount?: number },
): string {
  const colorCount = options?.colorCount ?? 1;
  const sizeCount = options?.sizeCount ?? 1;
  if (colorCount > 1 && sizeCount > 1) return `${color} / ${size}`;
  if (colorCount > 1) return color;
  return size;
}
