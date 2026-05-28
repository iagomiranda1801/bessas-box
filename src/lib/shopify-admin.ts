import type { ShopifyProduct } from "@/lib/shopify";

const SHOPIFY_API_VERSION = "2025-07";

function getAdminConfig() {
  const store =
    process.env.SHOPIFY_STORE_DOMAIN ??
    process.env.VITE_SHOPIFY_STORE_DOMAIN ??
    "uvhyj5-ty.myshopify.com";
  const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN ?? "";
  return {
    store,
    token,
    url: `https://${store}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
  };
}

async function adminApiRequest<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const { url, token } = getAdminConfig();
  if (!token) {
    throw new Error("SHOPIFY_ADMIN_ACCESS_TOKEN não configurado.");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Shopify Admin HTTP error: ${response.status}`);
  }

  const data = await response.json();
  if (data.errors?.length) {
    const msg = data.errors.map((e: { message: string }) => e.message).join(", ");
    throw new Error(`Shopify Admin: ${msg}`);
  }

  return data.data as T;
}

const ADMIN_PRODUCTS_QUERY = `
  query GetAdminProducts($first: Int!) {
    products(first: $first, query: "status:active") {
      edges {
        node {
          id
          title
          description
          handle
          priceRangeV2 {
            minVariantPrice { amount currencyCode }
          }
          featuredMedia {
            preview {
              image { url altText }
            }
          }
          images(first: 5) {
            edges {
              node { url altText }
            }
          }
          variants(first: 25) {
            edges {
              node {
                id
                title
                price
                availableForSale
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

const ADMIN_PRODUCT_BY_HANDLE_QUERY = `
  query GetAdminProductByHandle($handle: String!) {
    productByHandle(handle: $handle) {
      id
      title
      description
      handle
      priceRangeV2 {
        minVariantPrice { amount currencyCode }
      }
      featuredMedia {
        preview {
          image { url altText }
        }
      }
      images(first: 10) {
        edges {
          node { url altText }
        }
      }
      variants(first: 25) {
        edges {
          node {
            id
            title
            price
            availableForSale
            selectedOptions { name value }
          }
        }
      }
      options { name values }
    }
  }
`;

type AdminProductNode = {
  id: string;
  title: string;
  description: string;
  handle: string;
  priceRangeV2: {
    minVariantPrice: { amount: string; currencyCode: string };
  };
  featuredMedia?: {
    preview?: { image?: { url: string; altText: string | null } | null } | null;
  } | null;
  images: { edges: Array<{ node: { url: string; altText: string | null } }> };
  variants: {
    edges: Array<{
      node: {
        id: string;
        title: string;
        price: string;
        availableForSale: boolean;
        selectedOptions: Array<{ name: string; value: string }>;
      };
    }>;
  };
  options: Array<{ name: string; values: string[] }>;
};

function mapAdminProduct(node: AdminProductNode): ShopifyProduct {
  const featuredUrl = node.featuredMedia?.preview?.image?.url;
  const imageEdges = node.images.edges.length
    ? node.images.edges
    : featuredUrl
      ? [{ node: { url: featuredUrl, altText: node.featuredMedia?.preview?.image?.altText ?? null } }]
      : [];

  const variants = node.variants.edges.map(({ node: v }) => ({
    node: {
      id: v.id,
      title: v.title,
      price: {
        amount: v.price,
        currencyCode: node.priceRangeV2.minVariantPrice.currencyCode,
      },
      availableForSale: v.availableForSale,
      selectedOptions: v.selectedOptions,
    },
  }));

  return {
    node: {
      id: node.id,
      title: node.title,
      description: node.description ?? "",
      handle: node.handle,
      priceRange: { minVariantPrice: node.priceRangeV2.minVariantPrice },
      images: { edges: imageEdges },
      variants: { edges: variants },
      options: node.options,
    },
  };
}

export function hasAdminApiToken() {
  return Boolean(process.env.SHOPIFY_ADMIN_ACCESS_TOKEN);
}

export async function fetchProductsAdmin(first = 24): Promise<ShopifyProduct[]> {
  const data = await adminApiRequest<{
    products: { edges: Array<{ node: AdminProductNode }> };
  }>(ADMIN_PRODUCTS_QUERY, { first });

  return data.products.edges.map(({ node }) => mapAdminProduct(node));
}

export async function fetchProductByHandleAdmin(handle: string): Promise<ShopifyProduct | null> {
  const data = await adminApiRequest<{ productByHandle: AdminProductNode | null }>(
    ADMIN_PRODUCT_BY_HANDLE_QUERY,
    { handle },
  );

  if (!data.productByHandle) return null;
  return mapAdminProduct(data.productByHandle);
}
