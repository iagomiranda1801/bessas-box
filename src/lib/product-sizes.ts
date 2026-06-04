export type SizeProfile = 'apparel' | 'shoe' | 'jeans' | 'one_size';

export type ProductCategory =
  | 'camiseta'
  | 'polo'
  | 'shorts'
  | 'tenis'
  | 'calca_jeans'
  | 'bone';

export type SizeStock = Record<string, number>;

export const SIZES_BY_PROFILE: Record<SizeProfile, readonly string[]> = {
  apparel: ['M', 'G', 'GG'],
  shoe: ['38', '39', '40', '41', '42', '43', '44'],
  jeans: ['38', '40', '42', '44'],
  one_size: ['Único'],
};

export const PRODUCT_CATEGORIES: Array<{
  id: ProductCategory;
  label: string;
  sizeProfile: SizeProfile;
}> = [
  { id: 'camiseta', label: 'Camiseta', sizeProfile: 'apparel' },
  { id: 'polo', label: 'Polo', sizeProfile: 'apparel' },
  { id: 'shorts', label: 'Shorts', sizeProfile: 'apparel' },
  { id: 'tenis', label: 'Tênis', sizeProfile: 'shoe' },
  { id: 'calca_jeans', label: 'Calça jeans', sizeProfile: 'jeans' },
  { id: 'bone', label: 'Boné', sizeProfile: 'one_size' },
];

const CATEGORY_BY_ID = new Map(PRODUCT_CATEGORIES.map((c) => [c.id, c]));

const VARIANT_PREFIX = 'supabase-variant-';
const VARIANT_SEPARATOR = '--';

export function getSizeProfileForCategory(category: ProductCategory): SizeProfile {
  return CATEGORY_BY_ID.get(category)?.sizeProfile ?? 'apparel';
}

export function getSizesForCategory(category: ProductCategory): readonly string[] {
  return SIZES_BY_PROFILE[getSizeProfileForCategory(category)];
}

export function getSizesForProfile(profile: SizeProfile): readonly string[] {
  return SIZES_BY_PROFILE[profile];
}

export function emptySizeStock(profile: SizeProfile): SizeStock {
  return Object.fromEntries(getSizesForProfile(profile).map((size) => [size, 0]));
}

export function sumSizeStock(sizeStock: SizeStock | null | undefined): number {
  if (!sizeStock || typeof sizeStock !== 'object') return 0;
  return Object.values(sizeStock).reduce((sum, qty) => sum + (Number(qty) || 0), 0);
}

export function normalizeSizeStock(
  profile: SizeProfile,
  raw: SizeStock | null | undefined,
): SizeStock {
  const sizes = getSizesForProfile(profile);
  const normalized = emptySizeStock(profile);
  if (!raw || typeof raw !== 'object') return normalized;
  for (const size of sizes) {
    const qty = raw[size];
    if (typeof qty === 'number' && qty >= 0) normalized[size] = Math.floor(qty);
  }
  return normalized;
}

export function buildVariantId(productId: string, size: string): string {
  return `${VARIANT_PREFIX}${productId}${VARIANT_SEPARATOR}${encodeURIComponent(size)}`;
}

export function parseVariantId(
  variantId: string,
): { productId: string; size: string } | null {
  if (!variantId.startsWith(VARIANT_PREFIX)) return null;
  const rest = variantId.slice(VARIANT_PREFIX.length);
  const sepIndex = rest.indexOf(VARIANT_SEPARATOR);
  if (sepIndex === -1) {
    return { productId: rest, size: getSizesForProfile('apparel')[0] ?? 'M' };
  }
  const productId = rest.slice(0, sepIndex);
  const size = decodeURIComponent(rest.slice(sepIndex + VARIANT_SEPARATOR.length));
  return productId ? { productId, size } : null;
}

export function cartLineKey(productId: string, size: string): string {
  return `${productId}::${size}`;
}

/** Heurística para migrar produtos existentes sem categoria. */
export function inferCategoryFromTitle(title: string): ProductCategory {
  const t = title.toLowerCase();
  if (/t[eê]nis|sneaker|tenis/.test(t)) return 'tenis';
  if (/bon[eé]|bone|cap/.test(t)) return 'bone';
  if (/jeans|cal[cç]a/.test(t)) return 'calca_jeans';
  if (/polo/.test(t)) return 'polo';
  if (/short/.test(t)) return 'shorts';
  return 'camiseta';
}

export function initialSizeStockFromTotal(
  profile: SizeProfile,
  total: number,
): SizeStock {
  const stock = emptySizeStock(profile);
  const sizes = getSizesForProfile(profile);
  if (sizes.length > 0) stock[sizes[0]!] = Math.max(0, total);
  return stock;
}
