import { storefrontApiRequest } from '@/lib/shopify';

const CUSTOMER_CREATE_MUTATION = `
  mutation customerCreate($input: CustomerCreateInput!) {
    customerCreate(input: $input) {
      customer {
        id
        email
        firstName
        lastName
      }
      customerUserErrors {
        code
        field
        message
      }
    }
  }
`;

const CUSTOMER_ACCESS_TOKEN_CREATE_MUTATION = `
  mutation customerAccessTokenCreate($input: CustomerAccessTokenCreateInput!) {
    customerAccessTokenCreate(input: $input) {
      customerAccessToken {
        accessToken
        expiresAt
      }
      customerUserErrors {
        code
        field
        message
      }
    }
  }
`;

const CUSTOMER_ACCESS_TOKEN_DELETE_MUTATION = `
  mutation customerAccessTokenDelete($customerAccessToken: String!) {
    customerAccessTokenDelete(customerAccessToken: $customerAccessToken) {
      deletedAccessToken
      deletedCustomerAccessTokenId
      userErrors {
        field
        message
      }
    }
  }
`;

const CART_BUYER_IDENTITY_UPDATE_MUTATION = `
  mutation cartBuyerIdentityUpdate($cartId: ID!, $buyerIdentity: CartBuyerIdentityInput!) {
    cartBuyerIdentityUpdate(cartId: $cartId, buyerIdentity: $buyerIdentity) {
      cart {
        id
        checkoutUrl
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export type CustomerSession = {
  accessToken: string;
  expiresAt: string;
  email: string;
};

export type CustomerAuthResult =
  | { ok: true; session: CustomerSession }
  | { ok: false; message: string };

export type CartAssociateResult =
  | { ok: true }
  | { ok: false; message: string };

function translateCustomerError(message: string, code?: string): string {
  const lower = message.toLowerCase();
  if (code === 'TAKEN' || lower.includes('taken') || lower.includes('already been taken')) {
    return 'Este e-mail já está cadastrado. Faça login ou use outro e-mail.';
  }
  if (lower.includes('password') && lower.includes('short')) {
    return 'A senha deve ter pelo menos 5 caracteres.';
  }
  if (lower.includes('invalid') && lower.includes('email')) {
    return 'E-mail inválido.';
  }
  if (lower.includes('unidentified customer') || lower.includes('incorrect')) {
    return 'E-mail ou senha incorretos.';
  }
  if (lower.includes('customer is disabled')) {
    return 'Conta desativada. Entre em contato com a loja.';
  }
  return message || 'Não foi possível concluir. Tente novamente.';
}

function formatCustomerUserErrors(
  errors: Array<{ message: string; code?: string }> | undefined,
): string {
  if (!errors?.length) return 'Não foi possível concluir. Tente novamente.';
  const first = errors[0];
  return translateCustomerError(first.message, first.code);
}

function formatCartUserErrors(errors: Array<{ message: string }> | undefined): string {
  if (!errors?.length) return 'Não foi possível atualizar a sacola.';
  return errors.map((e) => e.message).join('. ');
}

export async function serverRegisterCustomer(input: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  acceptsMarketing?: boolean;
}): Promise<CustomerAuthResult> {
  const data = await storefrontApiRequest(CUSTOMER_CREATE_MUTATION, {
    input: {
      email: input.email,
      password: input.password,
      firstName: input.firstName || undefined,
      lastName: input.lastName || undefined,
      acceptsMarketing: input.acceptsMarketing ?? false,
    },
  });

  if (!data) {
    return { ok: false, message: 'Serviço indisponível. Tente novamente.' };
  }

  const payload = data.data?.customerCreate;
  const userErrors = payload?.customerUserErrors ?? [];
  if (userErrors.length > 0) {
    return { ok: false, message: formatCustomerUserErrors(userErrors) };
  }

  const customer = payload?.customer;
  if (!customer?.email) {
    return { ok: false, message: 'Não foi possível criar a conta.' };
  }

  return serverLoginCustomer({ email: input.email, password: input.password });
}

export async function serverLoginCustomer(input: {
  email: string;
  password: string;
}): Promise<CustomerAuthResult> {
  const data = await storefrontApiRequest(CUSTOMER_ACCESS_TOKEN_CREATE_MUTATION, {
    input: { email: input.email, password: input.password },
  });

  if (!data) {
    return { ok: false, message: 'Serviço indisponível. Tente novamente.' };
  }

  const payload = data.data?.customerAccessTokenCreate;
  const userErrors = payload?.customerUserErrors ?? [];
  if (userErrors.length > 0) {
    return { ok: false, message: formatCustomerUserErrors(userErrors) };
  }

  const token = payload?.customerAccessToken;
  if (!token?.accessToken) {
    return { ok: false, message: 'E-mail ou senha incorretos.' };
  }

  return {
    ok: true,
    session: {
      accessToken: token.accessToken,
      expiresAt: token.expiresAt,
      email: input.email,
    },
  };
}

export async function serverLogoutCustomer(accessToken: string): Promise<{ ok: boolean }> {
  const data = await storefrontApiRequest(CUSTOMER_ACCESS_TOKEN_DELETE_MUTATION, {
    customerAccessToken: accessToken,
  });
  if (!data) return { ok: false };
  const userErrors = data.data?.customerAccessTokenDelete?.userErrors ?? [];
  return { ok: userErrors.length === 0 };
}

export async function serverAssociateCartWithCustomer(
  cartId: string,
  customerAccessToken: string,
): Promise<CartAssociateResult> {
  const data = await storefrontApiRequest(CART_BUYER_IDENTITY_UPDATE_MUTATION, {
    cartId,
    buyerIdentity: { customerAccessToken },
  });

  if (!data) {
    return { ok: false, message: 'Não foi possível vincular sua conta à sacola.' };
  }

  const userErrors = data.data?.cartBuyerIdentityUpdate?.userErrors ?? [];
  if (userErrors.length > 0) {
    return { ok: false, message: formatCartUserErrors(userErrors) };
  }

  return { ok: true };
}

export async function serverAssociateCartEmail(
  cartId: string,
  email: string,
): Promise<CartAssociateResult> {
  const data = await storefrontApiRequest(CART_BUYER_IDENTITY_UPDATE_MUTATION, {
    cartId,
    buyerIdentity: { email },
  });

  if (!data) {
    return { ok: false, message: 'Não foi possível salvar o e-mail na sacola.' };
  }

  const userErrors = data.data?.cartBuyerIdentityUpdate?.userErrors ?? [];
  if (userErrors.length > 0) {
    return { ok: false, message: formatCartUserErrors(userErrors) };
  }

  return { ok: true };
}
