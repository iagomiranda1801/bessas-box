import { createServerFn } from '@tanstack/react-start';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { getPaymentProvider } from '@/lib/catalog-config';
import { getPayment, getPixQrCode, isAsaasConfigured } from '@/lib/payments/asaas-client';
import { buildDemoPixCharge } from '@/lib/payments/asaas.provider';
import { getPaymentProviderInstance } from '@/lib/payments';
import { cleanCpf, validateCpf } from '@/lib/cpf-utils';
import type { OrderRow, OrderStatus } from '@/lib/order-types';
import type { PaymentChargeStatus } from '@/lib/payment-charge-types';
import type { PaymentChargeResult } from '@/lib/payments/types';
import type { SizeProfile, SizeStock } from '@/lib/product-sizes';
import {
  availableStockForProduct,
  DEFAULT_COLOR,
  flattenToSizeStock,
  resolveProductColors,
  resolveVariantStock,
  sumVariantStock,
  type VariantStock,
} from '@/lib/product-variants';
import { getSupabaseAnonServerClient, getSupabaseServiceClient } from '@/lib/supabase-server';

const checkoutItemSchema = z.object({
  productId: z.string().uuid(),
  color: z.string().min(1).optional(),
  size: z.string().min(1),
  quantity: z.number().int().positive(),
});

type CheckoutProductRow = {
  id: string;
  title: string;
  price_cents: number;
  stock_quantity: number;
  is_active: boolean;
  size_stock?: SizeStock | null;
  size_profile?: SizeProfile | string | null;
  product_colors?: string[] | null;
  variant_stock?: VariantStock | null;
};

const createOrderSchema = z.object({
  customerEmail: z.string().email(),
  customerCpf: z
    .string()
    .min(1)
    .transform((value) => cleanCpf(value))
    .pipe(z.string().length(11, 'CPF inválido.')),
  accessToken: z.string().min(1).optional(),
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
  carrierService: z.string().nullish(),
});

const SCHEMA_COLUMN_ERROR = /schema cache|could not find the '[^']+' column/i;

type OrderInsert = Record<string, unknown>;

async function resolveCheckoutUserId(
  accessToken: string | undefined,
  customerEmail: string,
): Promise<{ ok: true; userId: string | null } | { ok: false; message: string }> {
  if (!accessToken) return { ok: true, userId: null };

  const { data, error } = await getSupabaseAnonServerClient().auth.getUser(accessToken);
  if (error || !data.user?.email) {
    return { ok: false, message: 'Sessao expirada. Entre novamente para vincular o pedido.' };
  }

  if (data.user.email.toLowerCase() !== customerEmail.trim().toLowerCase()) {
    return { ok: false, message: 'O e-mail do pedido precisa ser o mesmo da conta logada.' };
  }

  return { ok: true, userId: data.user.id };
}

function paymentAccessSecret(): string {
  const secret =
    process.env.PAYMENT_ACCESS_SECRET?.trim() ??
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secret) throw new Error('PAYMENT_ACCESS_SECRET ou SUPABASE_SERVICE_ROLE_KEY ausente.');
  return secret;
}

function buildPaymentAccessToken(orderId: string): string {
  return createHmac('sha256', paymentAccessSecret()).update(orderId).digest('hex');
}

function verifyPaymentAccessToken(orderId: string, token: string | undefined): boolean {
  if (!token) return false;
  try {
    const expected = Buffer.from(buildPaymentAccessToken(orderId), 'hex');
    const received = Buffer.from(token, 'hex');
    return expected.length === received.length && timingSafeEqual(expected, received);
  } catch {
    return false;
  }
}

async function customerCanAccessOrder(
  customerAccessToken: string | undefined,
  order: { user_id?: string | null; customer_email?: string | null },
): Promise<boolean> {
  if (!customerAccessToken) return false;
  const { data, error } = await getSupabaseAnonServerClient().auth.getUser(customerAccessToken);
  if (error || !data.user?.email) return false;
  return (
    data.user.id === order.user_id ||
    data.user.email.toLowerCase() === order.customer_email?.toLowerCase()
  );
}

async function decrementLegacyStock(
  client: ReturnType<typeof getSupabaseServiceClient>,
  product: CheckoutProductRow,
  quantity: number,
) {
  await client
    .from('products')
    .update({
      stock_quantity: product.stock_quantity - quantity,
      updated_at: new Date().toISOString(),
    })
    .eq('id', product.id);
}

function buildOrderInsertAttempts(
  data: z.infer<typeof createOrderSchema>,
  totalCents: number,
  userId: string | null,
): OrderInsert[] {
  const common = {
    user_id: userId,
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

  const withoutCpf = { ...withShipping };
  delete withoutCpf.customer_cpf;

  // Tenta sem customer_cpf primeiro (coluna pode não existir no Supabase)
  const attempts: OrderInsert[] = [];
  if (hasAddress) {
    attempts.push({ ...withoutCpf, shipping_address: data.shippingAddress });
  }
  attempts.push(withoutCpf);
  if (hasAddress) {
    attempts.push({ ...withShipping, shipping_address: data.shippingAddress });
  }
  attempts.push(withShipping);
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
    billing_type: 'UNDEFINED',
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
  id, user_id, status, total_cents, payment_id, payment_provider,
  customer_email, shipping_name, created_at, paid_at
`;

type PixDisplay = {
  pixQrCode: string | null;
  pixCopyPaste: string | null;
  invoiceUrl: string | null;
  expiresAt: string | null;
  isDemo: boolean;
};

type PaymentChargeRow = {
  pix_qr_code: string | null;
  pix_copy_paste: string | null;
  invoice_url: string | null;
  expires_at: string | null;
  external_id: string | null;
  metadata: Record<string, unknown> | null;
};

async function persistPaymentCharge(
  client: ReturnType<typeof getSupabaseServiceClient>,
  chargeRow: ReturnType<typeof buildChargeInsert>,
): Promise<void> {
  const full = await client.from('payment_charges').insert(chargeRow);
  if (!full.error) return;

  if (SCHEMA_COLUMN_ERROR.test(full.error.message)) {
    const minimal = {
      order_id: chargeRow.order_id,
      provider: chargeRow.provider,
      external_id: chargeRow.external_id,
      billing_type: chargeRow.billing_type,
      amount_cents: chargeRow.amount_cents,
      status: chargeRow.status,
      pix_qr_code: chargeRow.pix_qr_code,
      pix_copy_paste: chargeRow.pix_copy_paste,
    };
    const retry = await client.from('payment_charges').insert(minimal);
    if (retry.error) {
      console.warn('[checkout] payment_charges:', retry.error.message);
    }
    return;
  }

  console.warn('[checkout] payment_charges:', full.error.message);
}

async function resolvePixDisplay(
  orderId: string,
  order: { payment_id?: string | null; payment_provider?: string | null },
  charge: PaymentChargeRow | null,
): Promise<PixDisplay> {
  const chargeInvoiceUrl = charge?.invoice_url ?? null;

  if (charge?.pix_copy_paste || charge?.pix_qr_code) {
    const metadata = (charge.metadata ?? {}) as Record<string, unknown>;
    return {
      pixQrCode: charge.pix_qr_code,
      pixCopyPaste: charge.pix_copy_paste,
      invoiceUrl: chargeInvoiceUrl,
      expiresAt: charge.expires_at,
      isDemo: metadata.demo === true,
    };
  }

  const paymentId = order.payment_id?.trim();
  if (!paymentId) {
    return {
      pixQrCode: null,
      pixCopyPaste: null,
      invoiceUrl: chargeInvoiceUrl,
      expiresAt: null,
      isDemo: false,
    };
  }

  if (paymentId.startsWith('asaas-stub-') || paymentId.startsWith('mp-stub-')) {
    const demo = buildDemoPixCharge({ id: orderId });
    const payload = demo.chargePayload;
    return {
      pixQrCode: demo.pixQrCode ?? payload?.pixQrCode ?? null,
      pixCopyPaste: demo.pixCopyPaste ?? payload?.pixCopyPaste ?? null,
      invoiceUrl: chargeInvoiceUrl,
      expiresAt: payload?.expiresAt ?? null,
      isDemo: true,
    };
  }

  if (getPaymentProvider() === 'asaas' && isAsaasConfigured()) {
    let invoiceUrl = chargeInvoiceUrl;
    let pixQrCode: string | null = null;
    let pixCopyPaste: string | null = null;
    let expiresAt: string | null = null;

    try {
      const pix = await getPixQrCode(paymentId);
      pixQrCode = pix.encodedImage;
      pixCopyPaste = pix.payload;
      expiresAt = pix.expirationDate ?? null;
    } catch (error) {
      console.warn('[checkout] Falha ao buscar Pix no Asaas:', error);
    }

    if (!invoiceUrl) {
      try {
        const payment = await getPayment(paymentId);
        invoiceUrl = payment.invoiceUrl ?? null;
      } catch (error) {
        console.warn('[checkout] Falha ao buscar fatura no Asaas:', error);
      }
    }

    return { pixQrCode, pixCopyPaste, invoiceUrl, expiresAt, isDemo: false };
  }

  return {
    pixQrCode: null,
    pixCopyPaste: null,
    invoiceUrl: chargeInvoiceUrl,
    expiresAt: null,
    isDemo: false,
  };
}

function orderRowForCharge(
  order: Record<string, unknown>,
  data: z.infer<typeof createOrderSchema>,
): OrderRow {
  return {
    ...(order as OrderRow),
    customer_cpf:
      (order.customer_cpf as string | null | undefined) ?? cleanCpf(data.customerCpf),
    shipping_name:
      (order.shipping_name as string | null | undefined) ?? data.shippingName,
    shipping_phone:
      (order.shipping_phone as string | null | undefined) ?? data.shippingPhone ?? null,
  };
}

export const createSupabaseOrderFn = createServerFn({ method: 'POST' })
  .inputValidator(createOrderSchema)
  .handler(async ({ data }) => {
    try {
    if (!validateCpf(data.customerCpf)) {
      return { ok: false as const, message: 'CPF inválido.' };
    }

    const checkoutUser = await resolveCheckoutUserId(data.accessToken, data.customerEmail);
    if (!checkoutUser.ok) return checkoutUser;

    const client = getSupabaseServiceClient();
    const productIds = data.items.map((i) => i.productId);

    let productsResult = await client
      .from('products')
      .select(
        'id, title, price_cents, stock_quantity, is_active, size_stock, size_profile, product_colors, variant_stock',
      )
      .in('id', productIds);

    if (productsResult.error && SCHEMA_COLUMN_ERROR.test(productsResult.error.message)) {
      productsResult = await client
        .from('products')
        .select('id, title, price_cents, stock_quantity, is_active')
        .in('id', productIds);
    }

    const products = productsResult.data as CheckoutProductRow[] | null;
    if (productsResult.error || !products?.length) {
      return { ok: false as const, message: 'Produtos inválidos.' };
    }

    const productMap = new Map(products.map((p) => [p.id, p]));
    let totalCents = 0;
    const lineItems: Array<{
      product_id: string;
      product_title: string;
      quantity: number;
      unit_price_cents: number;
      size: string;
      color: string;
    }> = [];

    for (const item of data.items) {
      const product = productMap.get(item.productId);
      if (!product?.is_active) {
        return { ok: false as const, message: `Produto indisponível.` };
      }
      const color = item.color || DEFAULT_COLOR;
      const available = availableStockForProduct(product, color, item.size);
      if (available < item.quantity) {
        const label =
          color !== DEFAULT_COLOR ? `${color} / ${item.size}` : item.size;
        return {
          ok: false as const,
          message: `Estoque insuficiente para ${product.title} (${label}).`,
        };
      }
      totalCents += product.price_cents * item.quantity;
      const titleSuffix =
        color !== DEFAULT_COLOR ? `${color} — ${item.size}` : item.size;
      lineItems.push({
        product_id: product.id,
        product_title: `${product.title} — ${titleSuffix}`,
        quantity: item.quantity,
        unit_price_cents: product.price_cents,
        size: item.size,
        color,
      });
    }

    totalCents += data.shippingCostCents ?? 0;

    const insertAttempts = buildOrderInsertAttempts(data, totalCents, checkoutUser.userId);
    let order: Record<string, unknown> | null = null;
    let orderError: { message: string } | null = null;
    let usedLegacySchema = false;

    for (let i = 0; i < insertAttempts.length; i++) {
      const payload = insertAttempts[i]!;
      const result = await client.from('orders').insert(payload).select('*').single();
      if (!result.error && result.data) {
        order = result.data as Record<string, unknown>;
        usedLegacySchema = (order.status as string) === 'pending';
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

    let itemsError = (
      await client.from('order_items').insert(
        lineItems.map((li) => ({
          order_id: orderId,
          product_id: li.product_id,
          product_title: li.product_title,
          quantity: li.quantity,
          unit_price_cents: li.unit_price_cents,
          size: li.size,
          color: li.color,
        })),
      )
    ).error;

    if (itemsError && SCHEMA_COLUMN_ERROR.test(itemsError.message)) {
      itemsError = (
        await client.from('order_items').insert(
          lineItems.map((li) => ({
            order_id: orderId,
            product_id: li.product_id,
            product_title: li.product_title,
            quantity: li.quantity,
            unit_price_cents: li.unit_price_cents,
            size: li.size,
          })),
        )
      ).error;
    }

    if (itemsError) {
      await client.from('orders').delete().eq('id', orderId);
      return { ok: false as const, message: itemsError.message };
    }

    for (const item of data.items) {
      const product = productMap.get(item.productId)!;
      const profile = (product.size_profile as SizeProfile) ?? 'apparel';
      const color = item.color || DEFAULT_COLOR;
      const colors = resolveProductColors(product.product_colors);
      const variantStock = resolveVariantStock(
        profile,
        colors,
        product.variant_stock as VariantStock | undefined,
        product.size_stock as SizeStock | undefined,
        product.stock_quantity,
      );
      const hasResolvedStock = sumVariantStock(variantStock) > 0;

      if (hasResolvedStock) {
        const row = variantStock[color] ?? {};
        row[item.size] = Math.max(0, (row[item.size] ?? 0) - item.quantity);
        variantStock[color] = row;
        const sizeStock = flattenToSizeStock(profile, variantStock);
        const newTotal = sumVariantStock(variantStock);
        const { error: stockError } = await client
          .from('products')
          .update({
            variant_stock: variantStock,
            size_stock: sizeStock,
            stock_quantity: newTotal,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.productId);
        if (stockError && SCHEMA_COLUMN_ERROR.test(stockError.message)) {
          await decrementLegacyStock(client, product, item.quantity);
        }
      } else {
        await decrementLegacyStock(client, product, item.quantity);
      }
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
      const { error: shipmentError } = await client.from('shipments').insert({
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
      });
      if (shipmentError) {
        console.warn('[checkout] Erro ao criar shipment:', shipmentError.message);
      }
    }

    let charge: PaymentChargeResult;
    try {
      const provider = getPaymentProviderInstance();
      charge = await provider.createCharge(orderRowForCharge(order, data));
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
    await persistPaymentCharge(client, chargeRow);

    await client
      .from('orders')
      .update({
        payment_id: charge.paymentId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    const paymentAccessToken = buildPaymentAccessToken(orderId);

    return {
      ok: true as const,
      orderId,
      paymentAccessToken,
      checkoutUrl: `${charge.checkoutUrl ?? `/checkout/pagar/${orderId}`}?token=${paymentAccessToken}`,
      pixQrCode: charge.pixQrCode,
      pixCopyPaste: charge.pixCopyPaste,
    };
    } catch (error) {
      console.error('[checkout] createSupabaseOrderFn:', error);
      const message =
        error instanceof Error ? error.message : 'Erro inesperado ao finalizar o pedido.';
      return { ok: false as const, message };
    }
  });

export const getCheckoutPaymentFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      orderId: z.string().uuid(),
      paymentAccessToken: z.string().optional(),
      customerAccessToken: z.string().optional(),
    }),
  )
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

    const authorized =
      verifyPaymentAccessToken(data.orderId, data.paymentAccessToken) ||
      (await customerCanAccessOrder(data.customerAccessToken, order));

    if (!authorized) {
      return { ok: false as const, message: 'Acesso ao pagamento nao autorizado.' };
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

    const pix = await resolvePixDisplay(data.orderId, row, charge as PaymentChargeRow | null);

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
        pixQrCode: pix.pixQrCode,
        pixCopyPaste: pix.pixCopyPaste,
        invoiceUrl: pix.invoiceUrl,
        expiresAt: pix.expiresAt,
        isDemo: pix.isDemo,
        chargeStatus: (charge?.status as PaymentChargeStatus | undefined) ?? 'pending',
      },
    };
  });

export const getOrderPaymentStatusFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      orderId: z.string().uuid(),
      paymentAccessToken: z.string().optional(),
      customerAccessToken: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const client = getSupabaseServiceClient();

    const { data: order, error } = await client
      .from('orders')
      .select('id, status, paid_at, user_id, customer_email')
      .eq('id', data.orderId)
      .maybeSingle();

    if (error || !order) {
      return { ok: false as const, message: 'Pedido não encontrado.' };
    }

    const authorized =
      verifyPaymentAccessToken(data.orderId, data.paymentAccessToken) ||
      (await customerCanAccessOrder(data.customerAccessToken, order));

    if (!authorized) {
      return { ok: false as const, message: 'Acesso ao pagamento nao autorizado.' };
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
