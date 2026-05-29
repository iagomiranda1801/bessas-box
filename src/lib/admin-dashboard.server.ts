import { createServerFn } from '@tanstack/react-start';
import { accessTokenSchema, requireAdmin } from '@/lib/admin-auth.server';
import type { OrderRow } from '@/lib/order-types';
import { getSupabaseServiceClient } from '@/lib/supabase-server';

const LOW_STOCK_THRESHOLD = 3;

export type AdminDashboardStats = {
  ordersLast7Days: number;
  ordersLast30Days: number;
  revenuePaidCents: number;
  pendingOrders: number;
  lowStockCount: number;
  productCount: number;
  customerCount: number;
};

export async function fetchAdminDashboardStats(): Promise<AdminDashboardStats> {
  const client = getSupabaseServiceClient();
  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [orders7, orders30, paidOrders, pending, lowStock, products, profileCount] = await Promise.all([
    client.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', d7),
    client.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', d30),
    client.from('orders').select('total_cents').eq('status', 'paid'),
    client
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'awaiting_payment', 'paid', 'processing']),
    client
      .from('products')
      .select('id', { count: 'exact', head: true })
      .lte('stock_quantity', LOW_STOCK_THRESHOLD),
    client.from('products').select('id', { count: 'exact', head: true }),
    client.from('profiles').select('id', { count: 'exact', head: true }),
  ]);

  const revenuePaidCents = (paidOrders.data ?? []).reduce(
    (sum, row) => sum + (row.total_cents ?? 0),
    0,
  );

  return {
    ordersLast7Days: orders7.count ?? 0,
    ordersLast30Days: orders30.count ?? 0,
    revenuePaidCents,
    pendingOrders: pending.count ?? 0,
    lowStockCount: lowStock.count ?? 0,
    productCount: products.count ?? 0,
    customerCount: profileCount.count ?? 0,
  };
}

export async function fetchRecentOrders(limit = 5): Promise<OrderRow[]> {
  const client = getSupabaseServiceClient();
  const { data, error } = await client
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('fetchRecentOrders:', error.message);
    return [];
  }
  return (data ?? []) as OrderRow[];
}

export const adminDashboardFn = createServerFn({ method: 'POST' })
  .inputValidator(accessTokenSchema)
  .handler(async ({ data }) => {
    await requireAdmin(data.accessToken);
    const [stats, recentOrders] = await Promise.all([
      fetchAdminDashboardStats(),
      fetchRecentOrders(5),
    ]);
    return { ok: true as const, stats, recentOrders };
  });
