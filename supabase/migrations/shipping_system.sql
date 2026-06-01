-- Sistema de Gestão de Entrega
-- SQL Editor → Run

-- Adicionar campos de entrega na tabela orders
alter table public.orders
  add column if not exists shipping_cep text,
  add column if not exists shipping_city text,
  add column if not exists shipping_state text,
  add column if not exists is_local_delivery boolean default false,
  add column if not exists shipping_cost_cents integer default 0;

-- Adicionar peso aos produtos
alter table public.products
  add column if not exists weight_kg numeric(5,2) default 0.5;

-- Tabela de envios
create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  shipping_method text not null, -- 'correios' | 'uber' | 'local_pickup'
  carrier_service text, -- 'PAC', 'SEDEX', 'uber_connect', etc
  tracking_code text,
  estimated_delivery_date date,
  actual_delivery_date date,
  shipping_cost_cents integer not null,
  pickup_address jsonb, -- endereço de coleta (loja)
  delivery_address jsonb not null, -- endereço de entrega
  status text not null default 'pending', -- 'pending', 'shipped', 'in_transit', 'delivered'
  external_tracking_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tabela de tarifas de envio
create table if not exists public.shipping_rates (
  id uuid primary key default gen_random_uuid(),
  method text not null, -- 'correios', 'uber_local'
  service_name text not null, -- 'PAC', 'SEDEX', 'Uber Connect'
  is_local boolean not null default false, -- true para Uberaba
  base_cost_cents integer not null,
  weight_factor numeric(5,2) default 0, -- custo por kg adicional
  distance_factor numeric(5,2) default 0, -- custo por km (Uber)
  max_weight_kg numeric(5,2), -- peso máximo suportado
  estimated_days_min integer not null,
  estimated_days_max integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Índices
create index if not exists shipments_order_id_idx on public.shipments(order_id);
create index if not exists shipments_status_idx on public.shipments(status);
create index if not exists shipping_rates_method_idx on public.shipping_rates(method, is_local, is_active);

-- RLS
alter table public.shipments enable row level security;
alter table public.shipping_rates enable row level security;

-- Policies para shipments
drop policy if exists "Cliente ve envios dos seus pedidos" on public.shipments;
create policy "Cliente ve envios dos seus pedidos"
  on public.shipments for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and (
          o.user_id = auth.uid()
          or lower(o.customer_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
    )
  );

-- Policies para shipping_rates (público para consulta)
drop policy if exists "Tarifas ativas sao publicas" on public.shipping_rates;
create policy "Tarifas ativas sao publicas"
  on public.shipping_rates for select
  using (is_active = true);

-- Dados iniciais de tarifas
insert into public.shipping_rates (method, service_name, is_local, base_cost_cents, estimated_days_min, estimated_days_max) values
('uber_local', 'Uber Connect', true, 800, 1, 1),
('correios', 'PAC', false, 1500, 8, 12),
('correios', 'SEDEX', false, 2500, 3, 5)
on conflict do nothing;

-- Recarregar schema
notify pgrst, 'reload schema';