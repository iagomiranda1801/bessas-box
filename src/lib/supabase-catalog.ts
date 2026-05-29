import type { AdminProductRow, StoreProduct } from '@/lib/catalog-types';
import { getSupabaseAnonServerClient, getSupabaseServiceClient } from '@/lib/supabase-server';

function mapRowToStoreProduct(row: AdminProductRow): StoreProduct {
  const images = [...(row.product_images ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  const primary = images.find((i) => i.is_primary) ?? images[0];
  const priceAmount = (row.price_cents / 100).toFixed(2);
  const variantId = `supabase-variant-${row.id}`;

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
    variants: [
      {
        id: variantId,
        title: 'Default Title',
        price: { amount: priceAmount, currencyCode: row.currency || 'BRL' },
        availableForSale: row.is_active && row.stock_quantity > 0,
        quantityAvailable: row.stock_quantity,
        selectedOptions: [],
      },
    ],
    isActive: row.is_active,
    isFeatured: row.is_featured,
    stockQuantity: row.stock_quantity,
  };
}

const PRODUCT_SELECT = `
  id, title, slug, description, price_cents, currency, stock_quantity,
  is_active, is_featured, created_at,
  product_images ( id, storage_path, public_url, alt_text, sort_order, is_primary )
`;

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

  const { data, error } = await query;
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
  const { data, error } = await client
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error('Supabase fetch product:', error.message);
    return null;
  }

  return mapRowToStoreProduct(data as AdminProductRow);
}

export async function fetchAdminProductById(id: string): Promise<AdminProductRow | null> {
  const client = getSupabaseServiceClient();
  const { data, error } = await client
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;
  return data as AdminProductRow;
}

export async function fetchAllAdminProducts(): Promise<AdminProductRow[]> {
  const client = getSupabaseServiceClient();
  const { data, error } = await client
    .from('products')
    .select(PRODUCT_SELECT)
    .order('created_at', { ascending: false });

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
