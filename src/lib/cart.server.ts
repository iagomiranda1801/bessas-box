import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import {
  serverCartAddLine,
  serverCartCreate,
  serverCartExists,
  serverGetCartCheckoutUrl,
  serverCartRemoveLine,
  serverCartUpdateLine,
} from '@/lib/shopify-cart';

const lineSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().positive(),
});

const cartLineSchema = z.object({
  cartId: z.string().min(1),
  lineId: z.string().min(1),
  quantity: z.number().int().positive(),
});

const cartRemoveSchema = z.object({
  cartId: z.string().min(1),
  lineId: z.string().min(1),
});

const cartIdSchema = z.object({
  cartId: z.string().min(1),
});

export const cartCreateFn = createServerFn({ method: 'POST' })
  .inputValidator(lineSchema)
  .handler(async ({ data }) => serverCartCreate(data.variantId, data.quantity));

export const cartAddLineFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      cartId: z.string().min(1),
      variantId: z.string().min(1),
      quantity: z.number().int().positive(),
    }),
  )
  .handler(async ({ data }) =>
    serverCartAddLine(data.cartId, data.variantId, data.quantity),
  );

export const cartUpdateLineFn = createServerFn({ method: 'POST' })
  .inputValidator(cartLineSchema)
  .handler(async ({ data }) =>
    serverCartUpdateLine(data.cartId, data.lineId, data.quantity),
  );

export const cartRemoveLineFn = createServerFn({ method: 'POST' })
  .inputValidator(cartRemoveSchema)
  .handler(async ({ data }) => serverCartRemoveLine(data.cartId, data.lineId));

export const cartSyncFn = createServerFn({ method: 'POST' })
  .inputValidator(cartIdSchema)
  .handler(async ({ data }) => {
    const exists = await serverCartExists(data.cartId);
    return { exists };
  });

export const cartCheckoutFn = createServerFn({ method: 'POST' })
  .inputValidator(cartIdSchema)
  .handler(async ({ data }) => serverGetCartCheckoutUrl(data.cartId));
