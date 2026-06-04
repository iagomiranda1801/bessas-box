import type { AdminProductRow, StoreProduct } from '@/lib/catalog-types';
import {
  buildVariantId,
  getSizesForProfile,
  inferCategoryFromTitle,
  initialSizeStockFromTotal,
  normalizeSizeStock,
  sumSizeStock,
  type ProductCategory,
  type SizeProfile,
  type SizeStock,
} from '@/lib/product-sizes';
import { getSupabaseAnonServerClient, getSupabaseServiceClient } from '@/lib/supabase-server';

function parseProductCategory(value: string | null | undefined): ProductCategory {
  const valid: ProductCategory[] = [
    'camiseta',
    'polo',
    'shorts',
    'tenis',
    'calca_jeans',
    'bone',
  ];
  if (value && valid.includes(value as ProductCategory)) {
    return value as ProductCategory;
  }
  return 'camiseta';
}

function parseSizeProfile(value: string | null | undefined): SizeProfile {
  const valid: SizeProfile[] = ['apparel', 'shoe', 'jeans', 'one_size'];
  if (value && valid.includes(value as SizeProfile)) {
    return value as SizeProfile;
  }
  return 'apparel';
}

function resolveSizeStock(row: AdminProductRow): SizeStock {
  const profile = parseSizeProfile(row.size_profile);
  const raw = row.size_stock;
  if (raw && typeof raw === 'object' && Object.keys(raw).length > 0) {
    return normalizeSizeStock(profile, raw as SizeStock);
  }
  return initialSizeStockFromTotal(profile, row.stock_quantity ?? 0);
}

function mapRowToStoreProduct(row: AdminProductRow): StoreProduct {
  const images = [...(row.product_images ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  const priceAmount = (row.price_cents / 100).toFixed(2);
  const productCategory = row.product_category
    ? parseProductCategory(row.product_category)
    : inferCategoryFromTitle(row.title);
  const sizeProfile = parseSizeProfile(row.size_profile);
  const sizeStock = resolveSizeStock(row);
  const sizes = getSizesForProfile(sizeProfile);

  const variants = sizes.map((size) => {
    const qty = sizeStock[size] ?? 0;
    return {
      id: buildVariantId(row.id, size),
      title: size,
      price: { amount: priceAmount, currencyCode: row.currency || 'BRL' },
      availableForSale: row.is_active && qty > 0,
      quantityAvailable: qty,
      selectedOptions: [{ name: 'Tamanho', value: size }],
    };
  });

  return {
    id: row.id,
    title: row.title,
    handle: row.slug,
    description: row.description ?? '',
    price: { amount: priceAmount, currencyCode: row.currency || 'BRL' },
    images: images.map((img) => ({
      url: img.public_url,
      altText: img.alt_text ?? row.title,
    })),
    variants,
    isActive: row.is_active,
    isFeatured: row.is_featured,
    stockQuantity: sumSizeStock(sizeStock),
    productCategory,
    sizeProfile,
  };
}

const PRODUCT_SELECT = `
  id, title, slug, description, price_cents, currency, stock_quantity,
  is_active, is_featured, product_category, size_profile, size_stock, created_at,
  product_images ( id, storage_path, public_url, alt_text, sort_order, is_primary )
`;

const PRODUCT_SELECT_LEGACY = `
  id, title, slug, description, price_cents, currency, stock_quantity,
  is_active, is_featured, created_at,
  product_images ( id, storage_path, public_url, alt_text, sort_order, is_primary )
`;

const SCHEMA_COLUMN_ERROR = /schema cache|could not find the '[^']+' column/i;

export async function fetchProductsFromSupabase(options?: {
  limit?: number;
  featuredOnly?: boolean;
  includeInactive?: boolean;
}): Promise<StoreProduct[]> {
  const limit = options?.limit ?? 48;
  const client = options?.includeInactive
    ? getSupabaseServiceClient()
    : getSupabaseAnonServerClient();

  let query = client
    .from('products')
    .select(PRODUCT_SELECT)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!options?.includeInactive) {
    query = query.eq('is_active', true);
  }
  if (options?.featuredOnly) {
    query = query.eq('is_featured', true);
  }

  let { data, error } = await query;
  if (error && SCHEMA_COLUMN_ERROR.test(error.message)) {
    let legacyQuery = client
      .from('products')
      .select(PRODUCT_SELECT_LEGACY)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (!options?.includeInactive) legacyQuery = legacyQuery.eq('is_active', true);
    if (options?.featuredOnly) legacyQuery = legacyQuery.eq('is_featured', true);
    const legacy = await legacyQuery;
    data = legacy.data;
    error = legacy.error;
  }
  if (error) {
    console.error('Supabase fetch products:', error.message);
    return [];
  }

  return (data as AdminProductRow[]).map(mapRowToStoreProduct);
}

export async function fetchProductBySlugFromSupabase(
  slug: string,
): Promise<StoreProduct | null> {
  const client = getSupabaseAnonServerClient();
  let { data, error } = await client
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  if (error && SCHEMA_COLUMN_ERROR.test(error.message)) {
    const legacy = await client
      .from('products')
      .select(PRODUCT_SELECT_LEGACY)
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle();
    data = legacy.data;
    error = legacy.error;
  }

  if (error || !data) {
    if (error) console.error('Supabase fetch product:', error.message);
    return null;
  }

  return mapRowToStoreProduct(data as AdminProductRow);
}

export async function fetchAdminProductById(id: string): Promise<AdminProductRow | null> {
  const client = getSupabaseServiceClient();
  let { data, error } = await client
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error && SCHEMA_COLUMN_ERROR.test(error.message)) {
    const legacy = await client
      .from('products')
      .select(PRODUCT_SELECT_LEGACY)
      .eq('id', id)
      .maybeSingle();
    data = legacy.data;
    error = legacy.error;
  }

  if (error || !data) return null;
  return data as AdminProductRow;
}

export async function fetchAllAdminProducts(): Promise<AdminProductRow[]> {
  const client = getSupabaseServiceClient();
  let { data, error } = await client
    .from('products')
    .select(PRODUCT_SELECT)
    .order('created_at', { ascending: false });

  if (error && SCHEMA_COLUMN_ERROR.test(error.message)) {
    const legacy = await client
      .from('products')
      .select(PRODUCT_SELECT_LEGACY)
      .order('created_at', { ascending: false });
    data = legacy.data;
    error = legacy.error;
  }

  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []) as AdminProductRow[];
}

export function getPublicImageUrl(storagePath: string): string {
  const base = (
    process.env.VITE_SUPABASE_URL ??
    import.meta.env.VITE_SUPABASE_URL ??
    ''
  ).replace(/\/$/, '');
  return `${base}/storage/v1/object/public/product-images/${storagePath}`;
}

export { inferCategoryFromTitle, mapRowToStoreProduct };
