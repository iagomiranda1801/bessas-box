import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import {
  serverAssociateCartEmail,
  serverAssociateCartWithCustomer,
  serverLoginCustomer,
  serverLogoutCustomer,
  serverRegisterCustomer,
} from '@/lib/shopify-customer';
import { serverValidateCartForCheckout } from '@/lib/shopify-cart';

const emailSchema = z.string().email('E-mail inválido');
const passwordSchema = z.string().min(5, 'A senha deve ter pelo menos 5 caracteres');

const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  acceptsMarketing: z.boolean().optional(),
});

const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

const logoutSchema = z.object({
  accessToken: z.string().min(1),
});

const associateCartSchema = z.object({
  cartId: z.string().min(1),
  customerAccessToken: z.string().min(1),
});

const checkoutSchema = z.object({
  cartId: z.string().min(1),
  customerAccessToken: z.string().min(1).optional(),
  guestEmail: emailSchema.optional(),
});

export const customerRegisterFn = createServerFn({ method: 'POST' })
  .inputValidator(registerSchema)
  .handler(async ({ data }) => serverRegisterCustomer(data));

export const customerLoginFn = createServerFn({ method: 'POST' })
  .inputValidator(loginSchema)
  .handler(async ({ data }) => serverLoginCustomer(data));

export const customerLogoutFn = createServerFn({ method: 'POST' })
  .inputValidator(logoutSchema)
  .handler(async ({ data }) => serverLogoutCustomer(data.accessToken));

export const customerAssociateCartFn = createServerFn({ method: 'POST' })
  .inputValidator(associateCartSchema)
  .handler(async ({ data }) =>
    serverAssociateCartWithCustomer(data.cartId, data.customerAccessToken),
  );

export const cartCheckoutFn = createServerFn({ method: 'POST' })
  .inputValidator(checkoutSchema)
  .handler(async ({ data }) => {
    if (data.customerAccessToken) {
      const associated = await serverAssociateCartWithCustomer(
        data.cartId,
        data.customerAccessToken,
      );
      if (!associated.ok) {
        return { ok: false as const, message: associated.message };
      }
    } else if (data.guestEmail) {
      const associated = await serverAssociateCartEmail(data.cartId, data.guestEmail);
      if (!associated.ok) {
        return { ok: false as const, message: associated.message };
      }
    }

    return serverValidateCartForCheckout(data.cartId);
  });
