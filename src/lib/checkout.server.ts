import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { getPaymentProvider } from '@/lib/catalog-config';
import { getPaymentProviderInstance } from '@/lib/payments';
import type { OrderStatus } from '@/lib/order-types';
import { getSupabaseServiceClient } from '@/lib/supabase-server';

const checkoutItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
});

const createOrderSchema = z.object({
  customerEmail: z.string().email(),
  userId: z.string().uuid().optional(),
  items: z.array(checkoutItemSchema).min(1),
  shippingName: z.string().min(1).max(200),
  shippingPhone: z.string().max(30).optional(),
  shippingAddress: z.record(z.unknown()).optional(),
});

const SCHEMA_COLUMN_ERROR = /schema cache|could not find the '[^']+' column/i;

type OrderInsert = Record<string, unknown>;

function buildOrderInsertAttempts(
  data: z.infer<typeof createOrderSchema>,
  totalCents: number,
): OrderInsert[] {
  const common = {
    user_id: data.userId ?? null,
    customer_email: data.customerEmail,
    total_cents: totalCents,
    payment_provider: getPaymentProvider(),
  };

  const withShipping: OrderInsert = {
    ...common,
    status: 'awaiting_payment',
    shipping_name: data.shippingName,
    shipping_phone: data.shippingPhone ?? null,
  };

  const hasAddress =
    data.shippingAddress != null && Object.keys(data.shippingAddress).length > 0;

  const attempts: OrderInsert[] = hasAddress
    ? [{ ...withShipping, shipping_address: data.shippingAddress }]
    : [];
  attempts.push(withShipping, { ...common, status: 'pending' });

  return attempts;
}

function schemaMigrationHint(message: string) {
  return SCHEMA_COLUMN_ERROR.test(message)
    ? ' Rode no Supabase → SQL Editor o arquivo supabase/migrations/admin_orders.sql e depois Settings → API → Reload schema cache.'
    : '';
}

export const createSupabaseOrderFn = createServerFn({ method: 'POST' })
  .inputValidator(createOrderSchema)
  .handler(async ({ data }) => {
    const client = getSupabaseServiceClient();
    const productIds = data.items.map((i) => i.productId);

    const { data: products, error: productsError } = await client
      .from('products')
      .select('id, title, price_cents, stock_quantity, is_active')
      .in('id', productIds);

    if (productsError || !products?.length) {
      return { ok: false as const, message: 'Produtos inválidos.' };
    }

    const productMap = new Map(products.map((p) => [p.id, p]));
    let totalCents = 0;
    const lineItems: Array<{
      product_id: string;
      product_title: string;
      quantity: number;
      unit_price_cents: number;
    }> = [];

    for (const item of data.items) {
      const product = productMap.get(item.productId);
      if (!product?.is_active) {
        return { ok: false as const, message: `Produto indisponível.` };
      }
      if (product.stock_quantity < item.quantity) {
        return {
          ok: false as const,
          message: `Estoque insuficiente para ${product.title}.`,
        };
      }
      totalCents += product.price_cents * item.quantity;
      lineItems.push({
        product_id: product.id,
        product_title: product.title,
        quantity: item.quantity,
        unit_price_cents: product.price_cents,
      });
    }

    const insertAttempts = buildOrderInsertAttempts(data, totalCents);
    let order: Record<string, unknown> | null = null;
    let orderError: { message: string } | null = null;
    let usedLegacySchema = false;

    for (let i = 0; i < insertAttempts.length; i++) {
      const payload = insertAttempts[i]!;
      const result = await client.from('orders').insert(payload).select('*').single();
      if (!result.error && result.data) {
        order = result.data as Record<string, unknown>;
        usedLegacySchema = i === insertAttempts.length - 1;
        break;
      }
      orderError = result.error;
      if (result.error && !SCHEMA_COLUMN_ERROR.test(result.error.message)) break;
    }

    if (!order) {
      const msg = orderError?.message ?? 'Erro ao criar pedido.';
      return { ok: false as const, message: msg + schemaMigrationHint(msg) };
    }

    if (usedLegacySchema && lineItems[0]) {
      lineItems[0] = {
        ...lineItems[0],
        product_title: `[Entrega: ${data.shippingName}] ${lineItems[0].product_title}`,
      };
    }

    const { error: itemsError } = await client.from('order_items').insert(
      lineItems.map((li) => ({
        order_id: order.id as string,
        ...li,
      })),
    );

    if (itemsError) {
      await client.from('orders').delete().eq('id', order.id);
      return { ok: false as const, message: itemsError.message };
    }

    for (const item of data.items) {
      const product = productMap.get(item.productId)!;
      await client
        .from('products')
        .update({
          stock_quantity: product.stock_quantity - item.quantity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.productId);
    }

    const orderStatus = (order.status as OrderStatus) ?? 'pending';
    const { error: historyError } = await client.from('order_status_history').insert({
      order_id: order.id,
      status: orderStatus,
      changed_by: 'checkout',
    });
    if (historyError && SCHEMA_COLUMN_ERROR.test(historyError.message)) {
      console.warn('[checkout] order_status_history ausente — rode admin_orders.sql');
    }

    const provider = getPaymentProviderInstance();
    const charge = await provider.createCharge(order as import('@/lib/order-types').OrderRow);

    const paymentUpdate = { payment_id: charge.paymentId, updated_at: new Date().toISOString() };
    const { error: paymentUpdateError } = await client
      .from('orders')
      .update(paymentUpdate)
      .eq('id', order.id as string);
    if (paymentUpdateError?.message?.includes('updated_at')) {
      await client
        .from('orders')
        .update({ payment_id: charge.paymentId })
        .eq('id', order.id as string);
    }

    return {
      ok: true as const,
      orderId: order.id as string,
      checkoutUrl: charge.checkoutUrl,
      pixQrCode: charge.pixQrCode,
      pixCopyPaste: charge.pixCopyPaste,
    };
  });

export const paymentWebhookFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ payload: z.unknown() }))
  .handler(async ({ data }) => {
    const provider = getPaymentProviderInstance();
    const result = await provider.handleWebhook(data.payload);

    if (!result) return { ok: true as const, handled: false };

    const client = getSupabaseServiceClient();
    const updates: Record<string, unknown> = {
      status: result.status === 'paid' ? 'paid' : 'cancelled',
      updated_at: new Date().toISOString(),
    };
    if (result.status === 'paid') updates.paid_at = new Date().toISOString();
    if (result.paymentId) updates.payment_id = result.paymentId;

    await client.from('orders').update(updates).eq('id', result.orderId);
    await client.from('order_status_history').insert({
      order_id: result.orderId,
      status: updates.status,
      changed_by: 'webhook',
    });

    return { ok: true as const, handled: true, orderId: result.orderId };
  });

export const adminSettingsFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ accessToken: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import('@/lib/admin-auth.server');
    await requireAdmin(data.accessToken);
    const { getCatalogSource, getCartSource, getPaymentProvider, maskAdminEmails } = await import(
      '@/lib/catalog-config'
    );
    return {
      ok: true as const,
      catalogSource: getCatalogSource(),
      cartSource: getCartSource(),
      paymentProvider: getPaymentProvider(),
      adminEmailsMasked: maskAdminEmails(),
      hasMercadoPago: Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN?.trim()),
      hasAsaas: Boolean(process.env.ASAAS_API_KEY?.trim()),
    };
  });
