import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { getPaymentProvider } from '@/lib/catalog-config';
import { getPaymentProviderInstance } from '@/lib/payments';
import { cleanCpf, validateCpf } from '@/lib/cpf-utils';
import type { OrderRow, OrderStatus } from '@/lib/order-types';
import type { PaymentChargeStatus } from '@/lib/payment-charge-types';
import type { PaymentChargeResult } from '@/lib/payments/types';
import { getSupabaseServiceClient } from '@/lib/supabase-server';

const checkoutItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
});

const createOrderSchema = z.object({
  customerEmail: z.string().email(),
  customerCpf: z.string().min(11).max(14),
  userId: z.string().uuid().optional(),
  items: z.array(checkoutItemSchema).min(1),
  shippingName: z.string().min(1).max(200),
  shippingPhone: z.string().max(30).optional(),
  shippingAddress: z.record(z.unknown()).optional(),
  shippingCep: z.string().optional(),
  shippingCity: z.string().optional(),
  shippingState: z.string().optional(),
  isLocalDelivery: z.boolean().optional(),
  shippingCostCents: z.number().int().min(0).optional(),
  shippingMethod: z.string().optional(),
  carrierService: z.string().optional(),
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
    customer_cpf: cleanCpf(data.customerCpf),
  };

  const withShipping: OrderInsert = {
    ...common,
    status: 'awaiting_payment',
    shipping_name: data.shippingName,
    shipping_phone: data.shippingPhone ?? null,
    shipping_cep: data.shippingCep ?? null,
    shipping_city: data.shippingCity ?? null,
    shipping_state: data.shippingState ?? null,
    is_local_delivery: data.isLocalDelivery ?? false,
    shipping_cost_cents: data.shippingCostCents ?? 0,
  };

  const hasAddress =
    data.shippingAddress != null && Object.keys(data.shippingAddress).length > 0;

  const attempts: OrderInsert[] = hasAddress
    ? [{ ...withShipping, shipping_address: data.shippingAddress }]
    : [];
  attempts.push(withShipping);

  const withoutCpf = { ...withShipping };
  delete withoutCpf.customer_cpf;
  attempts.push(withoutCpf);
  attempts.push({ ...common, status: 'pending' });

  const commonWithoutCpf = { ...common };
  delete commonWithoutCpf.customer_cpf;
  attempts.push({ ...commonWithoutCpf, status: 'pending' });

  return attempts;
}

function schemaMigrationHint(message: string) {
  if (SCHEMA_COLUMN_ERROR.test(message)) {
    console.warn('[checkout] Schema desatualizado — rode as migrations no Supabase.');
    return ' Tente novamente em instantes.';
  }
  return '';
}

function buildChargeInsert(
  orderId: string,
  totalCents: number,
  customerCpf: string,
  charge: PaymentChargeResult,
) {
  const payload = charge.chargePayload;
  return {
    order_id: orderId,
    provider: getPaymentProvider(),
    external_id: charge.paymentId,
    billing_type: 'PIX',
    amount_cents: totalCents,
    status: 'pending' as PaymentChargeStatus,
    pix_qr_code: charge.pixQrCode ?? payload?.pixQrCode ?? null,
    pix_copy_paste: charge.pixCopyPaste ?? payload?.pixCopyPaste ?? null,
    invoice_url: payload?.invoiceUrl ?? null,
    expires_at: payload?.expiresAt ?? null,
    customer_cpf: cleanCpf(customerCpf),
    metadata: payload?.demo ? { demo: true } : null,
  };
}

const orderPaymentSelect = `
  id, status, total_cents, payment_id, payment_provider,
  customer_email, shipping_name, created_at, paid_at
`;

export const createSupabaseOrderFn = createServerFn({ method: 'POST' })
  .inputValidator(createOrderSchema)
  .handler(async ({ data }) => {
    if (!validateCpf(data.customerCpf)) {
      return { ok: false as const, message: 'CPF inválido.' };
    }

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

    totalCents += data.shippingCostCents ?? 0;

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

    const orderId = order.id as string;

    if (usedLegacySchema && lineItems[0]) {
      lineItems[0] = {
        ...lineItems[0],
        product_title: `[Entrega: ${data.shippingName}] ${lineItems[0].product_title}`,
      };
    }

    const { error: itemsError } = await client.from('order_items').insert(
      lineItems.map((li) => ({
        order_id: orderId,
        ...li,
      })),
    );

    if (itemsError) {
      await client.from('orders').delete().eq('id', orderId);
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
      order_id: orderId,
      status: orderStatus,
      changed_by: 'checkout',
    });
    if (historyError && SCHEMA_COLUMN_ERROR.test(historyError.message)) {
      console.warn('[checkout] order_status_history ausente — rode admin_orders.sql');
    }

    if (data.shippingMethod && data.shippingCostCents != null) {
      await client.from('shipments').insert({
        order_id: orderId,
        shipping_method: data.shippingMethod,
        carrier_service: data.carrierService || null,
        shipping_cost_cents: data.shippingCostCents,
        delivery_address: {
          name: data.shippingName,
          phone: data.shippingPhone,
          cep: data.shippingCep,
          city: data.shippingCity,
          state: data.shippingState,
          ...data.shippingAddress,
        },
        status: 'pending',
      }).catch(() => {
        console.warn('[checkout] Erro ao criar shipment');
      });
    }

    let charge: PaymentChargeResult;
    try {
      const provider = getPaymentProviderInstance();
      charge = await provider.createCharge(order as OrderRow);
    } catch (error) {
      await client.from('order_items').delete().eq('order_id', orderId);
      await client.from('orders').delete().eq('id', orderId);
      for (const item of data.items) {
        const product = productMap.get(item.productId)!;
        await client
          .from('products')
          .update({ stock_quantity: product.stock_quantity })
          .eq('id', item.productId);
      }
      const message = error instanceof Error ? error.message : 'Erro ao gerar cobrança.';
      return { ok: false as const, message };
    }

    const chargeRow = buildChargeInsert(orderId, totalCents, data.customerCpf, charge);
    const { error: chargeError } = await client.from('payment_charges').insert(chargeRow);

    if (chargeError) {
      console.warn('[checkout] payment_charges ausente — rode payment_charges.sql');
    }

    await client
      .from('orders')
      .update({
        payment_id: charge.paymentId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    return {
      ok: true as const,
      orderId,
      checkoutUrl: charge.checkoutUrl ?? `/checkout/pagar/${orderId}`,
      pixQrCode: charge.pixQrCode,
      pixCopyPaste: charge.pixCopyPaste,
    };
  });

export const getCheckoutPaymentFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ orderId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const client = getSupabaseServiceClient();

    const { data: order, error } = await client
      .from('orders')
      .select(`${orderPaymentSelect}, order_items (id, product_title, quantity, unit_price_cents)`)
      .eq('id', data.orderId)
      .maybeSingle();

    if (error || !order) {
      return { ok: false as const, message: 'Pedido não encontrado.' };
    }

    const row = order as OrderRow & {
      order_items?: Array<{ id: string; product_title: string; quantity: number; unit_price_cents: number }>;
    };

    const { data: charge } = await client
      .from('payment_charges')
      .select('*')
      .eq('order_id', data.orderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const metadata = (charge?.metadata ?? {}) as Record<string, unknown>;

    return {
      ok: true as const,
      order: {
        id: row.id,
        status: row.status,
        totalCents: row.total_cents,
        paymentProvider: row.payment_provider,
        paymentId: charge?.external_id ?? row.payment_id,
        createdAt: row.created_at,
        paidAt: row.paid_at,
        items: row.order_items ?? [],
        pixQrCode: charge?.pix_qr_code ?? null,
        pixCopyPaste: charge?.pix_copy_paste ?? null,
        expiresAt: charge?.expires_at ?? null,
        isDemo: metadata.demo === true,
        chargeStatus: (charge?.status as PaymentChargeStatus | undefined) ?? 'pending',
      },
    };
  });

export const getOrderPaymentStatusFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ orderId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const client = getSupabaseServiceClient();

    const { data: order, error } = await client
      .from('orders')
      .select('id, status, paid_at')
      .eq('id', data.orderId)
      .maybeSingle();

    if (error || !order) {
      return { ok: false as const, message: 'Pedido não encontrado.' };
    }

    return {
      ok: true as const,
      status: order.status as OrderStatus,
      paidAt: order.paid_at as string | null,
    };
  });

export const paymentWebhookFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ payload: z.unknown(), headers: z.record(z.string()).optional() }))
  .handler(async ({ data }) => {
    const headerObj = data.headers ?? {};
    const headers = new Headers(Object.entries(headerObj));

    const provider = getPaymentProviderInstance();
    const result = await provider.handleWebhook(data.payload, headers);

    if (!result) return { ok: true as const, handled: false };

    const client = getSupabaseServiceClient();
    const now = new Date().toISOString();

    let chargeQuery = client.from('payment_charges').select('id, status, order_id');

    if (result.paymentId) {
      chargeQuery = chargeQuery.eq('external_id', result.paymentId);
    } else {
      chargeQuery = chargeQuery.eq('order_id', result.orderId);
    }

    const { data: charge } = await chargeQuery
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (charge) {
      const paidStatuses: PaymentChargeStatus[] = ['received', 'confirmed'];
      if (paidStatuses.includes(result.chargeStatus) && paidStatuses.includes(charge.status as PaymentChargeStatus)) {
        return { ok: true as const, handled: true, orderId: result.orderId, duplicate: true };
      }

      const chargeUpdates: Record<string, unknown> = {
        status: result.chargeStatus,
        updated_at: now,
      };
      if (paidStatuses.includes(result.chargeStatus)) {
        chargeUpdates.paid_at = now;
      }

      await client.from('payment_charges').update(chargeUpdates).eq('id', charge.id);
    }

    const { data: existing } = await client
      .from('orders')
      .select('status')
      .eq('id', result.orderId)
      .maybeSingle();

    if (!existing) return { ok: true as const, handled: false };

    if (!result.orderStatus) {
      return { ok: true as const, handled: true, orderId: result.orderId };
    }

    if (result.orderStatus === 'paid' && existing.status === 'paid') {
      return { ok: true as const, handled: true, orderId: result.orderId, duplicate: true };
    }

    if (result.orderStatus !== 'paid' && existing.status !== 'awaiting_payment') {
      return { ok: true as const, handled: false, duplicate: true };
    }

    const orderUpdates: Record<string, unknown> = {
      status: result.orderStatus,
      updated_at: now,
    };
    if (result.orderStatus === 'paid') orderUpdates.paid_at = now;
    if (result.paymentId) orderUpdates.payment_id = result.paymentId;

    await client.from('orders').update(orderUpdates).eq('id', result.orderId);
    await client.from('order_status_history').insert({
      order_id: result.orderId,
      status: result.orderStatus,
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
