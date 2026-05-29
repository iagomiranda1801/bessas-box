import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { accessTokenSchema, requireAdmin } from '@/lib/admin-auth.server';
import type { AdminCustomerRow, OrderRow } from '@/lib/order-types';
import { getSupabaseServiceClient } from '@/lib/supabase-server';

export const adminListCustomersFn = createServerFn({ method: 'POST' })
  .inputValidator(
    accessTokenSchema.extend({
      search: z.string().optional(),
      limit: z.number().int().positive().max(100).optional(),
    }),
  )
  .handler(async ({ data }) => {
    await requireAdmin(data.accessToken);
    const client = getSupabaseServiceClient();
    const perPage = data.limit ?? 50;

    const { data: usersData, error } = await client.auth.admin.listUsers({
      page: 1,
      perPage,
    });

    if (error) return { ok: false as const, message: error.message };

    const users = usersData.users ?? [];
    const ids = users.map((u) => u.id);

    const { data: profiles } = await client
      .from('profiles')
      .select('id, full_name, phone')
      .in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    const { data: orderCounts } = await client.from('orders').select('user_id');

    const countByUser = new Map<string, number>();
    for (const o of orderCounts ?? []) {
      if (o.user_id) countByUser.set(o.user_id, (countByUser.get(o.user_id) ?? 0) + 1);
    }

    let customers: AdminCustomerRow[] = users.map((u) => {
      const profile = profileMap.get(u.id);
      return {
        id: u.id,
        email: u.email ?? '',
        full_name: profile?.full_name ?? (u.user_metadata?.full_name as string) ?? null,
        phone: profile?.phone ?? null,
        created_at: u.created_at,
        order_count: countByUser.get(u.id) ?? 0,
      };
    });

    const search = data.search?.trim().toLowerCase();
    if (search) {
      customers = customers.filter(
        (c) =>
          c.email.toLowerCase().includes(search) ||
          (c.full_name?.toLowerCase().includes(search) ?? false),
      );
    }

    return { ok: true as const, customers };
  });

export const adminGetCustomerFn = createServerFn({ method: 'POST' })
  .inputValidator(
    accessTokenSchema.extend({
      id: z.string().uuid(),
    }),
  )
  .handler(async ({ data }) => {
    await requireAdmin(data.accessToken);
    const client = getSupabaseServiceClient();

    const { data: userData, error: userError } = await client.auth.admin.getUserById(data.id);
    if (userError || !userData.user) {
      return { ok: false as const, message: 'Cliente não encontrado.' };
    }

    const user = userData.user;
    const { data: profile } = await client
      .from('profiles')
      .select('*')
      .eq('id', data.id)
      .maybeSingle();

    const { data: orders } = await client
      .from('orders')
      .select('*')
      .eq('user_id', data.id)
      .order('created_at', { ascending: false });

    const customer: AdminCustomerRow = {
      id: user.id,
      email: user.email ?? '',
      full_name: profile?.full_name ?? (user.user_metadata?.full_name as string) ?? null,
      phone: profile?.phone ?? null,
      created_at: user.created_at,
      order_count: orders?.length ?? 0,
    };

    return {
      ok: true as const,
      customer,
      orders: (orders ?? []) as OrderRow[],
    };
  });
