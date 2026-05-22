export const SHOPIFY_API_VERSION = '2025-07';
export const SHOPIFY_STORE_PERMANENT_DOMAIN =
  import.meta.env.VITE_SHOPIFY_STORE_DOMAIN ?? 'iwqyh2-ky.myshopify.com';
export const SHOPIFY_STOREFRONT_URL = `https://${SHOPIFY_STORE_PERMANENT_DOMAIN}/api/${SHOPIFY_API_VERSION}/graphql.json`;

/** Token público Headless — só no cliente (sacola/checkout). */
export const SHOPIFY_STOREFRONT_PUBLIC_TOKEN =
  import.meta.env.VITE_SHOPIFY_STOREFRONT_TOKEN ?? '';

function getPrivateStorefrontToken(): string {
  if (typeof window !== 'undefined') return '';
  return process.env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN?.trim() ?? '';
}

function getStorefrontAuthHeaders(): Record<string, string> | null {
  const privateToken = getPrivateStorefrontToken();
  if (privateToken) {
    return {
      'Content-Type': 'application/json',
      'Shopify-Storefront-Private-Token': privateToken,
    };
  }
  const publicToken = SHOPIFY_STOREFRONT_PUBLIC_TOKEN?.trim();
  if (publicToken) {
    return {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': publicToken,
    };
  }
  return null;
}

export function hasStorefrontToken(): boolean {
  return getStorefrontAuthHeaders() !== null;
}

export interface ShopifyProduct {
  node: {
    id: string;
    title: string;
    description: string;
    handle: string;
    priceRange: {
      minVariantPrice: { amount: string; currencyCode: string };
    };
    images: {
      edges: Array<{ node: { url: string; altText: string | null } }>;
    };
    variants: {
      edges: Array<{
        node: {
          id: string;
          title: string;
          price: { amount: string; currencyCode: string };
          availableForSale: boolean;
          quantityAvailable: number | null;
          selectedOptions: Array<{ name: string; value: string }>;
        };
      }>;
    };
    options: Array<{ name: string; values: string[] }>;
  };
}

export async function storefrontApiRequest(query: string, variables: Record<string, unknown> = {}) {
  const headers = getStorefrontAuthHeaders();
  if (!headers) {
    return null;
  }
  const response = await fetch(SHOPIFY_STOREFRONT_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });

  if (response.status === 402) {
    console.error('Shopify: Payment required. Visit https://admin.shopify.com to upgrade.');
    return null;
  }

  if (!response.ok) {
    throw new Error(`Shopify HTTP error: ${response.status}`);
  }

  const data = await response.json();
  if (data.errors) {
    throw new Error(`Shopify error: ${data.errors.map((e: { message: string }) => e.message).join(', ')}`);
  }
  return data;
}

export const PRODUCTS_QUERY = `
  query GetProducts($first: Int!, $query: String) {
    products(first: $first, query: $query) {
      edges {
        node {
          id title description handle
          priceRange { minVariantPrice { amount currencyCode } }
          images(first: 5) { edges { node { url altText } } }
          variants(first: 25) {
            edges {
              node {
                id title
                price { amount currencyCode }
                availableForSale
                quantityAvailable
                selectedOptions { name value }
              }
            }
          }
          options { name values }
        }
      }
    }
  }
`;

export const PRODUCT_BY_HANDLE_QUERY = `
  query GetProductByHandle($handle: String!) {
    product(handle: $handle) {
      id title description handle
      priceRange { minVariantPrice { amount currencyCode } }
      images(first: 10) { edges { node { url altText } } }
      variants(first: 25) {
        edges {
          node {
            id title
            price { amount currencyCode }
            availableForSale
            quantityAvailable
            selectedOptions { name value }
          }
        }
      }
      options { name values }
    }
  }
`;

export async function fetchProducts(first = 20, query?: string): Promise<ShopifyProduct[]> {
  if (!hasStorefrontToken()) return [];
  const data = await storefrontApiRequest(PRODUCTS_QUERY, { first, query });
  return data?.data?.products?.edges ?? [];
}

export async function fetchProductByHandle(handle: string): Promise<ShopifyProduct | null> {
  if (!hasStorefrontToken()) return null;
  const data = await storefrontApiRequest(PRODUCT_BY_HANDLE_QUERY, { handle });
  const product = data?.data?.product;
  if (!product) return null;
  return { node: product };
}
