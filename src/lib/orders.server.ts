import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { accessTokenSchema, requireAdmin } from '@/lib/admin-auth.server';
import { ORDER_STATUSES, type OrderRow, type OrderStatus } from '@/lib/order-types';
import {
  normalizeSizeStock,
  sumSizeStock,
  type SizeProfile,
  type SizeStock,
} from '@/lib/product-sizes';
import {
  DEFAULT_COLOR,
  flattenToSizeStock,
  normalizeVariantStock,
  resolveProductColors,
  sumVariantStock,
  type VariantStock,
} from '@/lib/product-variants';
import { getSupabaseServiceClient } from '@/lib/supabase-server';

const SCHEMA_COLUMN_ERROR = /schema cache|could not find the '[^']+' column/i;

function parseColorFromOrderItem(item: {
  color?: string | null;
  product_title: string;
}): string {
  if (item.color?.trim()) return item.color.trim();
  return DEFAULT_COLOR;
}

function parseSizeFromOrderItem(item: {
  size?: string | null;
  product_title: string;
}): string | null {
  if (item.size?.trim()) return item.size.trim();
  const match = item.product_title.match(/ — (.+)$/);
  const suffix = match?.[1]?.trim();
  if (!suffix) return null;
  const parts = suffix.split(' — ');
  return parts[parts.length - 1]?.trim() ?? suffix;
}

async function restoreProductStock(
  client: SupabaseClient,
  productId: string,
  color: string,
  size: string | null,
  quantity: number,
) {
  const { data: product, error } = await client
    .from('products')
    .select(
      'stock_quantity, size_stock, size_profile, product_colors, variant_stock',
    )
    .eq('id', productId)
    .maybeSingle();

  if (error || !product) return;

  const profile = (product.size_profile as SizeProfile) ?? 'apparel';
  const hasVariantStock =
    product.variant_stock &&
    typeof product.variant_stock === 'object' &&
    Object.keys(product.variant_stock as object).length > 0 &&
    size;

  if (hasVariantStock && size) {
    const colors = resolveProductColors(product.product_colors as string[] | null);
    const variantStock = normalizeVariantStock(
      profile,
      colors,
      product.variant_stock as VariantStock,
    );
    const row = variantStock[color] ?? {};
    row[size] = (row[size] ?? 0) + quantity;
    variantStock[color] = row;
    const sizeStock = flattenToSizeStock(profile, variantStock);
    const newTotal = sumVariantStock(variantStock);
    const { error: updateError } = await client
      .from('products')
      .update({
        variant_stock: variantStock,
        size_stock: sizeStock,
        stock_quantity: newTotal,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId);

    if (updateError && SCHEMA_COLUMN_ERROR.test(updateError.message)) {
      await restoreLegacySizeStock(client, productId, product, size, quantity);
    }
    return;
  }

  await restoreLegacySizeStock(client, productId, product, size, quantity);
}

async function restoreLegacySizeStock(
  client: SupabaseClient,
  productId: string,
  product: {
    stock_quantity: number;
    size_stock?: SizeStock | null;
    size_profile?: string | null;
  },
  size: string | null,
  quantity: number,
) {
  const profile = (product.size_profile as SizeProfile) ?? 'apparel';
  const hasSizeStock =
    product.size_stock &&
    typeof product.size_stock === 'object' &&
    Object.keys(product.size_stock as object).length > 0 &&
    size;

  if (hasSizeStock && size) {
    const sizeStock = normalizeSizeStock(profile, product.size_stock as SizeStock);
    sizeStock[size] = (sizeStock[size] ?? 0) + quantity;
    const newTotal = sumSizeStock(sizeStock);
    const { error: updateError } = await client
      .from('products')
      .update({
        size_stock: sizeStock,
        stock_quantity: newTotal,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId);

    if (updateError && SCHEMA_COLUMN_ERROR.test(updateError.message)) {
      await client
        .from('products')
        .update({
          stock_quantity: (product.stock_quantity as number) + quantity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', productId);
    }
  } else {
    await client
      .from('products')
      .update({
        stock_quantity: (product.stock_quantity as number) + quantity,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId);
  }
}

const ORDER_SELECT_FULL = `
  *,
  order_items (*),
  shipments (id, shipping_method, carrier_service, tracking_code, status, estimated_delivery_date, external_tracking_url),
  payment_charges (id, provider, external_id, billing_type, amount_cents, status, pix_qr_code, pix_copy_paste, invoice_url, expires_at, paid_at, created_at)
`;

const ORDER_SELECT_WITH_ITEMS = `
  *,
  order_items (*)
`;

const ORDER_SELECT_BASE = '*';

function isSchemaRelationError(message: string): boolean {
  return (
    SCHEMA_COLUMN_ERROR.test(message) ||
    /relation.*does not exist|Could not find a relationship/i.test(message)
  );
}

async function fetchOrdersWithFallback(
  client: SupabaseClient,
  build: (
    select: string,
  ) => ReturnType<ReturnType<SupabaseClient['from']>['select']>,
) {
  const attempts = [ORDER_SELECT_FULL, ORDER_SELECT_WITH_ITEMS, ORDER_SELECT_BASE];

  for (const select of attempts) {
    const result = await build(select);
    if (!result.error) {
      return { data: (result.data ?? []) as OrderRow[], error: null };
    }
    if (!isSchemaRelationError(result.error.message)) {
      return { data: null, error: result.error };
    }
    console.warn('[orders] Fallback select:', result.error.message);
  }

  return { data: null, error: { message: 'Não foi possível carregar pedidos.' } };
}

async function fetchOrderByIdWithFallback(client: SupabaseClient, id: string) {
  for (const select of [ORDER_SELECT_FULL, ORDER_SELECT_WITH_ITEMS, ORDER_SELECT_BASE]) {
    const result = await client.from('orders').select(select).eq('id', id).maybeSingle();
    if (!result.error) {
      return { data: result.data as OrderRow | null, error: null };
    }
    if (!isSchemaRelationError(result.error.message)) {
      return { data: null, error: result.error };
    }
  }
  return { data: null, error: { message: 'Pedido não encontrado.' } };
}

export const adminListOrdersFn = createServerFn({ method: 'POST' })
  .inputValidator(
    accessTokenSchema.extend({
      status: z.enum(ORDER_STATUSES).optional(),
      email: z.string().optional(),
      limit: z.number().int().positive().max(100).optional(),
    }),
  )
  .handler(async ({ data }) => {
    await requireAdmin(data.accessToken);
    const client = getSupabaseServiceClient();

    const { data: rows, error } = await fetchOrdersWithFallback(client, (select) => {
      let query = client
        .from('orders')
        .select(select)
        .order('created_at', { ascending: false })
        .limit(data.limit ?? 50);

      if (data.status) query = query.eq('status', data.status);
      if (data.email?.trim()) {
        query = query.ilike('customer_email', `%${data.email.trim()}%`);
      }
      return query;
    });

    if (error) return { ok: false as const, message: error.message };
    return { ok: true as const, orders: rows ?? [] };
  });

export const adminGetOrderFn = createServerFn({ method: 'POST' })
  .inputValidator(
    accessTokenSchema.extend({
      id: z.string().uuid(),
    }),
  )
  .handler(async ({ data }) => {
    await requireAdmin(data.accessToken);
    const client = getSupabaseServiceClient();

    const { data: order, error } = await fetchOrderByIdWithFallback(client, data.id);

    if (error) {
      return { ok: false as const, message: error.message };
    }
    if (!order) {
      return { ok: false as const, message: 'Pedido não encontrado.' };
    }

    const { data: history } = await client
      .from('order_status_history')
      .select('*')
      .eq('order_id', data.id)
      .order('created_at', { ascending: true });

    return {
      ok: true as const,
      order: order as OrderRow,
      history: history ?? [],
    };
  });

export const adminUpdateOrderStatusFn = createServerFn({ method: 'POST' })
  .inputValidator(
    accessTokenSchema.extend({
      id: z.string().uuid(),
      status: z.enum(ORDER_STATUSES),
    }),
  )
  .handler(async ({ data }) => {
    const auth = await requireAdmin(data.accessToken);
    const client = getSupabaseServiceClient();
    const updates: Record<string, unknown> = {
      status: data.status,
      updated_at: new Date().toISOString(),
    };
    if (data.status === 'paid') updates.paid_at = new Date().toISOString();

    const { error } = await client.from('orders').update(updates).eq('id', data.id);
    if (error) return { ok: false as const, message: error.message };

    await client.from('order_status_history').insert({
      order_id: data.id,
      status: data.status,
      changed_by: auth.email,
    });

    return { ok: true as const };
  });

export const adminDeleteOrderFn = createServerFn({ method: 'POST' })
  .inputValidator(
    accessTokenSchema.extend({
      id: z.string().uuid(),
    }),
  )
  .handler(async ({ data }) => {
    await requireAdmin(data.accessToken);
    const client = getSupabaseServiceClient();

    let fetchResult = await client
      .from('orders')
      .select('id, order_items (id, product_id, quantity, size, color, product_title)')
      .eq('id', data.id)
      .maybeSingle();

    if (fetchResult.error && isSchemaRelationError(fetchResult.error.message)) {
      fetchResult = await client
        .from('orders')
        .select('id, order_items (id, product_id, quantity, product_title)')
        .eq('id', data.id)
        .maybeSingle();
    }

    const order = fetchResult.data;
    if (fetchResult.error || !order) {
      return { ok: false as const, message: fetchResult.error?.message ?? 'Pedido não encontrado.' };
    }

    const items = (order.order_items ?? []) as Array<{
      product_id: string | null;
      quantity: number;
      size?: string | null;
      color?: string | null;
      product_title: string;
    }>;

    for (const item of items) {
      if (!item.product_id) continue;
      const color = parseColorFromOrderItem(item);
      const size = parseSizeFromOrderItem(item);
      await restoreProductStock(client, item.product_id, color, size, item.quantity);
    }

    const { error: deleteError } = await client.from('orders').delete().eq('id', data.id);

    if (deleteError) {
      return { ok: false as const, message: deleteError.message };
    }

    return { ok: true as const };
  });
