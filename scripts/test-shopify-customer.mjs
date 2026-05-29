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

const testEmail = `test+${Date.now()}@example.com`;
const testPassword = "Test12345";

async function gql(query, variables) {
  const r = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });
  return r.json();
}

console.log("Store:", domain);
console.log("--- Register ---");
const register = await gql(
  `mutation($input: CustomerCreateInput!) {
    customerCreate(input: $input) {
      customer { email }
      customerUserErrors { code message }
    }
  }`,
  {
    input: {
      email: testEmail,
      password: testPassword,
      firstName: "Test",
      acceptsMarketing: false,
    },
  },
);

const regErrors = register.data?.customerCreate?.customerUserErrors ?? [];
if (regErrors.length) {
  console.log("Register errors:", regErrors);
  if (regErrors.some((e) => e.message?.includes("Access denied") || e.code === "ACCESS_DENIED")) {
    console.log("Dica: adicione scopes unauthenticated_write_customers no app Headless.");
  }
  process.exit(1);
}
console.log("Registered:", register.data?.customerCreate?.customer?.email);

console.log("--- Login ---");
const login = await gql(
  `mutation($input: CustomerAccessTokenCreateInput!) {
    customerAccessTokenCreate(input: $input) {
      customerAccessToken { accessToken expiresAt }
      customerUserErrors { message }
    }
  }`,
  { input: { email: testEmail, password: testPassword } },
);

const tokenData = login.data?.customerAccessTokenCreate?.customerAccessToken;
if (!tokenData?.accessToken) {
  console.log("Login failed:", login);
  process.exit(1);
}
console.log("Login OK, token expires:", tokenData.expiresAt);

console.log("--- Guest cart checkout URL ---");
const products = await gql(`{ products(first: 1) { edges { node { variants(first:1){ edges { node { id } } } } } } }`);
const variantId = products.data?.products?.edges?.[0]?.node?.variants?.edges?.[0]?.node?.id;
if (!variantId) {
  console.log("No variant for cart test");
  process.exit(0);
}

const cart = await gql(
  `mutation($input: CartInput!) {
    cartCreate(input: $input) { cart { id checkoutUrl } userErrors { message } }
  }`,
  { input: { lines: [{ merchandiseId: variantId, quantity: 1 }] } },
);
const cartId = cart.data?.cartCreate?.cart?.id;
console.log("Cart:", cartId ? "OK" : "FAIL", cart.data?.cartCreate?.cart?.checkoutUrl ? "checkoutUrl OK" : "");

if (cartId && tokenData.accessToken) {
  const assoc = await gql(
    `mutation($cartId: ID!, $buyerIdentity: CartBuyerIdentityInput!) {
      cartBuyerIdentityUpdate(cartId: $cartId, buyerIdentity: $buyerIdentity) {
        cart { id }
        userErrors { message }
      }
    }`,
    { cartId, buyerIdentity: { customerAccessToken: tokenData.accessToken } },
  );
  console.log("Associate cart:", assoc.data?.cartBuyerIdentityUpdate?.userErrors?.length ? "ERR" : "OK");
}

console.log("Done.");
