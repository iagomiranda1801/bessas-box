import type { ShopifyProduct } from '@/lib/shopify';
import type { StoreProduct } from '@/lib/catalog-types';

/** Converte produto neutro → shape Shopify usado pelos componentes atuais. */
export function storeProductToShopifyShape(product: StoreProduct): ShopifyProduct {
  return {
    node: {
      id: product.id,
      title: product.title,
      description: product.description,
      handle: product.handle,
      priceRange: {
        minVariantPrice: product.price,
      },
      images: {
        edges: product.images.map((img) => ({
          node: { url: img.url, altText: img.altText },
        })),
      },
      variants: {
        edges: product.variants.map((v) => ({
          node: {
            id: v.id,
            title: v.title,
            price: v.price,
            availableForSale: v.availableForSale,
            quantityAvailable: v.quantityAvailable,
            selectedOptions: v.selectedOptions,
          },
        })),
      },
      options: [],
    },
  };
}

export function storeProductsToShopifyShape(products: StoreProduct[]): ShopifyProduct[] {
  return products.map(storeProductToShopifyShape);
}
