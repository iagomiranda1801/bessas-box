-- Admin: pedidos com status, envio e histórico
-- SQL Editor → Run

alter table public.orders
  add column if not exists shipping_name text,
  add column if not exists shipping_phone text,
  add column if not exists shipping_address jsonb,
  add column if not exists notes text,
  add column if not exists paid_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

-- Normaliza status legado
update public.orders set status = 'awaiting_payment' where status = 'pending';

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders
  add constraint orders_status_check check (
    status in (
      'pending',
      'awaiting_payment',
      'paid',
      'processing',
      'shipped',
      'delivered',
      'cancelled',
      'refunded'
    )
  );

create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null,
  changed_by text,
  created_at timestamptz not null default now()
);

create index if not exists order_status_history_order_id_idx
  on public.order_status_history(order_id);

alter table public.order_status_history enable row level security;

-- Histórico só via service_role (admin) — sem policy pública
