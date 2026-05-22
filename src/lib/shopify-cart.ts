import { storefrontApiRequest } from '@/lib/shopify';

const CART_QUERY = `query cart($id: ID!) { cart(id: $id) { id totalQuantity } }`;

const CART_CHECKOUT_QUERY = `
  query cartCheckout($id: ID!) {
    cart(id: $id) {
      id
      checkoutUrl
    }
  }
`;

/** Exibido quando checkout redireciona para /password (loja com senha ativa). */
export const CHECKOUT_PASSWORD_STORE_MESSAGE =
  'A loja Shopify está com senha ("Em breve"). No admin: Loja online → Preferências → desmarque "Restringir acesso" ou remova a senha. Headless também precisa disso para o checkout funcionar.';

const CART_CREATE_MUTATION = `
  mutation cartCreate($input: CartInput!) {
    cartCreate(input: $input) {
      cart {
        id
        checkoutUrl
        lines(first: 100) {
          edges {
            node {
              id
              merchandise { ... on ProductVariant { id } }
            }
          }
        }
      }
      userErrors { field message }
    }
  }`;

const CART_LINES_ADD_MUTATION = `
  mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart {
        id
        lines(first: 100) {
          edges {
            node {
              id
              merchandise { ... on ProductVariant { id } }
            }
          }
        }
      }
      userErrors { field message }
    }
  }`;

const CART_LINES_UPDATE_MUTATION = `
  mutation cartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) {
      cart { id }
      userErrors { field message }
    }
  }`;

const CART_LINES_REMOVE_MUTATION = `
  mutation cartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      cart { id }
      userErrors { field message }
    }
  }`;

export type CartServerResult =
  | { ok: true; cartId: string; checkoutUrl: string; lineId: string }
  | { ok: false; message: string; cartNotFound?: boolean };

function formatCheckoutUrl(checkoutUrl: string): string {
  try {
    const url = new URL(checkoutUrl);
    return url.toString();
  } catch {
    return checkoutUrl;
  }
}

function formatUserErrors(userErrors: Array<{ message: string }> | undefined): string {
  if (!userErrors?.length) return 'Não foi possível atualizar a sacola.';
  return userErrors.map((e) => e.message).join('. ');
}

function isCartNotFoundError(userErrors: Array<{ message: string }>) {
  return userErrors.some(
    (e) =>
      e.message.toLowerCase().includes('cart not found') ||
      e.message.toLowerCase().includes('does not exist'),
  );
}

function noTokenResult(): CartServerResult {
  return {
    ok: false,
    message:
      'Sacola indisponível: configure SHOPIFY_STOREFRONT_PRIVATE_TOKEN no servidor.',
  };
}

export async function serverCartCreate(
  variantId: string,
  quantity: number,
): Promise<CartServerResult> {
  const data = await storefrontApiRequest(CART_CREATE_MUTATION, {
    input: { lines: [{ quantity, merchandiseId: variantId }] },
  });
  if (!data) return noTokenResult();

  const payload = data.data?.cartCreate;
  const userErrors = payload?.userErrors ?? [];
  if (userErrors.length > 0) {
    return { ok: false, message: formatUserErrors(userErrors) };
  }

  const cart = payload?.cart;
  const lineId = cart?.lines?.edges?.[0]?.node?.id;
  if (!cart?.id || !cart.checkoutUrl || !lineId) {
    return { ok: false, message: 'A Shopify não retornou o carrinho. Verifique o canal Headless.' };
  }

  return {
    ok: true,
    cartId: cart.id,
    checkoutUrl: formatCheckoutUrl(cart.checkoutUrl),
    lineId,
  };
}

export async function serverCartAddLine(
  cartId: string,
  variantId: string,
  quantity: number,
): Promise<CartServerResult> {
  const data = await storefrontApiRequest(CART_LINES_ADD_MUTATION, {
    cartId,
    lines: [{ quantity, merchandiseId: variantId }],
  });
  if (!data) return noTokenResult();

  const userErrors = data.data?.cartLinesAdd?.userErrors ?? [];
  if (isCartNotFoundError(userErrors)) {
    return { ok: false, message: formatUserErrors(userErrors), cartNotFound: true };
  }
  if (userErrors.length > 0) {
    return { ok: false, message: formatUserErrors(userErrors) };
  }

  const lines = data.data?.cartLinesAdd?.cart?.lines?.edges ?? [];
  const newLine = lines.find(
    (l: { node: { merchandise: { id: string } } }) => l.node.merchandise.id === variantId,
  );
  const lineId = newLine?.node?.id;
  if (!lineId) {
    return { ok: false, message: 'Item não foi adicionado à sacola.' };
  }

  return { ok: true, cartId, checkoutUrl: '', lineId };
}

export async function serverCartUpdateLine(
  cartId: string,
  lineId: string,
  quantity: number,
): Promise<CartServerResult> {
  const data = await storefrontApiRequest(CART_LINES_UPDATE_MUTATION, {
    cartId,
    lines: [{ id: lineId, quantity }],
  });
  if (!data) return noTokenResult();

  const userErrors = data.data?.cartLinesUpdate?.userErrors ?? [];
  if (isCartNotFoundError(userErrors)) {
    return { ok: false, message: formatUserErrors(userErrors), cartNotFound: true };
  }
  if (userErrors.length > 0) {
    return { ok: false, message: formatUserErrors(userErrors) };
  }

  return { ok: true, cartId, checkoutUrl: '', lineId };
}

export async function serverCartRemoveLine(
  cartId: string,
  lineId: string,
): Promise<CartServerResult> {
  const data = await storefrontApiRequest(CART_LINES_REMOVE_MUTATION, {
    cartId,
    lineIds: [lineId],
  });
  if (!data) return noTokenResult();

  const userErrors = data.data?.cartLinesRemove?.userErrors ?? [];
  if (isCartNotFoundError(userErrors)) {
    return { ok: false, message: formatUserErrors(userErrors), cartNotFound: true };
  }
  if (userErrors.length > 0) {
    return { ok: false, message: formatUserErrors(userErrors) };
  }

  return { ok: true, cartId, checkoutUrl: '', lineId };
}

export async function serverCartExists(cartId: string): Promise<boolean> {
  const data = await storefrontApiRequest(CART_QUERY, { id: cartId });
  if (!data) return true;
  const cart = data.data?.cart;
  return Boolean(cart && cart.totalQuantity > 0);
}

export type CheckoutUrlResult =
  | { ok: true; checkoutUrl: string }
  | { ok: false; message: string };

export async function serverGetCartCheckoutUrl(cartId: string): Promise<CheckoutUrlResult> {
  const data = await storefrontApiRequest(CART_CHECKOUT_QUERY, { id: cartId });
  if (!data) return noTokenResult();

  const cart = data.data?.cart;
  if (!cart?.checkoutUrl) {
    return {
      ok: false,
      message: 'Carrinho inválido ou expirado. Adicione o produto à sacola novamente.',
    };
  }

  return { ok: true, checkoutUrl: formatCheckoutUrl(cart.checkoutUrl) };
}
