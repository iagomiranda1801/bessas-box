import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);

const domain = env.SHOPIFY_STORE_DOMAIN;
const token = env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN;
const url = `https://${domain}/api/2025-07/graphql.json`;

const PRODUCTS_QUERY = `
  query GetProducts($first: Int!) {
    products(first: $first) {
      edges {
        node {
          id title handle
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

const r = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Shopify-Storefront-Private-Token": token,
  },
  body: JSON.stringify({ query: PRODUCTS_QUERY, variables: { first: 48 } }),
});

const j = await r.json();
console.log("domain:", domain);
console.log("http:", r.status);
if (j.errors) {
  console.log("graphql errors:", JSON.stringify(j.errors, null, 2));
} else {
  const edges = j.data?.products?.edges ?? [];
  console.log("product count:", edges.length);
  for (const { node } of edges) {
    console.log(" -", node.title, "|", node.handle, "| imgs:", node.images.edges.length);
  }
}
