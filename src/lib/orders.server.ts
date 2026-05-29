import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { accessTokenSchema, requireAdmin } from '@/lib/admin-auth.server';
import { ORDER_STATUSES, type OrderRow, type OrderStatus } from '@/lib/order-types';
import { getSupabaseServiceClient } from '@/lib/supabase-server';

const orderSelect = `
  *,
  order_items (*)
`;

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
    let query = client
      .from('orders')
      .select(orderSelect)
      .order('created_at', { ascending: false })
      .limit(data.limit ?? 50);

    if (data.status) query = query.eq('status', data.status);
    if (data.email?.trim()) query = query.ilike('customer_email', `%${data.email.trim()}%`);

    const { data: rows, error } = await query;
    if (error) return { ok: false as const, message: error.message };
    return { ok: true as const, orders: (rows ?? []) as OrderRow[] };
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

    const { data: order, error } = await client
      .from('orders')
      .select(orderSelect)
      .eq('id', data.id)
      .maybeSingle();

    if (error || !order) {
      return { ok: false as const, message: error?.message ?? 'Pedido não encontrado.' };
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
