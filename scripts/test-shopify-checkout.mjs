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
const headers = {
  "Content-Type": "application/json",
  "Shopify-Storefront-Private-Token": token,
};

async function gql(query, variables) {
  const r = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });
  return r.json();
}

const productsRes = await gql(
  `{ products(first: 1) { edges { node { variants(first: 1) { edges { node { id title availableForSale quantityAvailable } } } } } } }`,
);
const variant = productsRes.data?.products?.edges?.[0]?.node?.variants?.edges?.[0]?.node;
if (!variant) {
  console.error("Nenhum produto/variante para testar");
  process.exit(1);
}

console.log("Variante:", variant.title, "| available:", variant.availableForSale, "| qty:", variant.quantityAvailable);

const createRes = await gql(
  `mutation($input: CartInput!) {
    cartCreate(input: $input) {
      cart {
        id checkoutUrl totalQuantity
        lines(first: 5) {
          edges {
            node {
              quantity
              merchandise {
                ... on ProductVariant {
                  title availableForSale quantityAvailable
                  product { title }
                }
              }
            }
          }
        }
      }
      userErrors { message }
    }
  }`,
  { input: { lines: [{ merchandiseId: variant.id, quantity: 1 }] } },
);

const cart = createRes.data?.cartCreate?.cart;
if (!cart?.id) {
  console.error("cartCreate failed:", JSON.stringify(createRes, null, 2));
  process.exit(1);
}

const line = cart.lines.edges[0]?.node;
console.log("Carrinho criado:", cart.id);
console.log("Linha qty:", line?.quantity, "| checkoutUrl:", Boolean(cart.checkoutUrl));
console.log(
  "Linha stock:",
  line?.merchandise?.availableForSale,
  line?.merchandise?.quantityAvailable,
);

if (!line?.merchandise?.availableForSale) {
  console.warn("AVISO: variante indisponível no carrinho — checkout da Shopify pode falhar.");
} else if (
  line.merchandise.quantityAvailable != null &&
  line.quantity > line.merchandise.quantityAvailable
) {
  console.warn("AVISO: quantidade na sacola acima do estoque.");
} else {
  console.log("OK: carrinho válido para checkout (validação básica).");
}
