export type StoreProductImage = {
  url: string;
  altText: string | null;
};

export type StoreProductVariant = {
  id: string;
  title: string;
  price: { amount: string; currencyCode: string };
  availableForSale: boolean;
  quantityAvailable: number | null;
  selectedOptions: Array<{ name: string; value: string }>;
};

export type StoreProduct = {
  id: string;
  title: string;
  handle: string;
  description: string;
  price: { amount: string; currencyCode: string };
  images: StoreProductImage[];
  variants: StoreProductVariant[];
  isActive: boolean;
  isFeatured: boolean;
  stockQuantity: number;
};

export type AdminProductRow = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  price_cents: number;
  currency: string;
  stock_quantity: number;
  is_active: boolean;
  is_featured: boolean;
  created_at: string;
  product_images: Array<{
    id: string;
    storage_path: string;
    public_url: string;
    alt_text: string | null;
    sort_order: number;
    is_primary: boolean;
  }>;
};
