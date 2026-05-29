import { storefrontApiRequest } from '@/lib/shopify';

const CART_QUERY = `query cart($id: ID!) { cart(id: $id) { id totalQuantity } }`;

const CART_CHECKOUT_QUERY = `
  query cartCheckout($id: ID!) {
    cart(id: $id) {
      id
      totalQuantity
      checkoutUrl
      lines(first: 100) {
        edges {
          node {
            quantity
            merchandise {
              ... on ProductVariant {
                id
                title
                availableForSale
                quantityAvailable
                product { title }
              }
            }
          }
        }
      }
    }
  }
`;

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

export type UnavailableLine = {
  title: string;
  reason: string;
};

export type CheckoutUrlResult =
  | { ok: true; checkoutUrl: string }
  | {
      ok: false;
      message: string;
      unavailableLines?: UnavailableLine[];
      cartNotFound?: boolean;
    };

type CartLineNode = {
  quantity: number;
  merchandise: {
    id: string;
    title: string;
    availableForSale: boolean;
    quantityAvailable: number | null;
    product: { title: string };
  };
};

type CartCheckoutPayload = {
  id: string;
  totalQuantity: number;
  checkoutUrl: string | null;
  lines: { edges: Array<{ node: CartLineNode }> };
};

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
  return { ok: false, message: 'Não foi possível atualizar a sacola. Tente novamente.' };
}

function noTokenCheckoutResult(): CheckoutUrlResult {
  return { ok: false, message: 'Não foi possível abrir o pagamento. Tente novamente.' };
}

function lineDisplayTitle(line: CartLineNode): string {
  const productTitle = line.merchandise.product?.title;
  if (productTitle && line.merchandise.title && line.merchandise.title !== 'Default Title') {
    return `${productTitle} (${line.merchandise.title})`;
  }
  return productTitle || line.merchandise.title || 'Produto';
}

function validateCartLines(cart: CartCheckoutPayload): UnavailableLine[] {
  const issues: UnavailableLine[] = [];

  for (const { node: line } of cart.lines.edges) {
    const title = lineDisplayTitle(line);
    const { availableForSale, quantityAvailable } = line.merchandise;

    if (!availableForSale) {
      issues.push({
        title,
        reason: 'indisponível para venda no momento',
      });
      continue;
    }

    if (quantityAvailable != null) {
      if (quantityAvailable === 0) {
        issues.push({ title, reason: 'esgotado' });
      } else if (line.quantity > quantityAvailable) {
        issues.push({
          title,
          reason:
            quantityAvailable === 1
              ? 'só há 1 unidade em estoque'
              : `só há ${quantityAvailable} unidades em estoque`,
        });
      }
    }
  }

  return issues;
}

export async function serverValidateCartForCheckout(cartId: string): Promise<CheckoutUrlResult> {
  const data = await storefrontApiRequest(CART_CHECKOUT_QUERY, { id: cartId });
  if (!data) return noTokenCheckoutResult();

  const cart = data.data?.cart as CartCheckoutPayload | null | undefined;
  if (!cart?.id) {
    return {
      ok: false,
      message: 'Sacola expirada — adicione os produtos novamente.',
      cartNotFound: true,
    };
  }

  if (!cart.totalQuantity || cart.totalQuantity < 1 || !cart.lines?.edges?.length) {
    return {
      ok: false,
      message: 'Sua sacola está vazia. Adicione produtos antes de finalizar.',
      cartNotFound: true,
    };
  }

  const unavailableLines = validateCartLines(cart);
  if (unavailableLines.length > 0) {
    const message = unavailableLines
      .map((l) => `${l.title}: ${l.reason}`)
      .join('. ');
    return { ok: false, message, unavailableLines };
  }

  if (!cart.checkoutUrl) {
    return {
      ok: false,
      message: 'Carrinho inválido ou expirado. Adicione o produto à sacola novamente.',
      cartNotFound: true,
    };
  }

  return { ok: true, checkoutUrl: formatCheckoutUrl(cart.checkoutUrl) };
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
    return { ok: false, message: 'Não foi possível adicionar à sacola. Tente novamente.' };
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

/** @deprecated Use serverValidateCartForCheckout */
export async function serverGetCartCheckoutUrl(cartId: string): Promise<CheckoutUrlResult> {
  return serverValidateCartForCheckout(cartId);
}
