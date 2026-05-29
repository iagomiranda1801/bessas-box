# Supabase — schema inicial (produtos, imagens, pedidos, perfis)
# SQL Editor → New query → Run → preferir "Run and enable RLS"

create extension if not exists "pgcrypto";

-- Produtos
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text,
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'BRL',
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  is_active boolean not null default true,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Imagens (URLs apontam para Storage bucket product-images)
create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null,
  public_url text not null,
  alt_text text,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

-- Perfil extra do cliente (login fica em auth.users — Authentication)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Pedidos (Mercado Pago / checkout futuro)
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  customer_email text not null,
  status text not null default 'pending',
  total_cents integer not null,
  currency text not null default 'BRL',
  payment_provider text,
  payment_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id),
  product_title text not null,
  quantity integer not null check (quantity > 0),
  unit_price_cents integer not null,
  created_at timestamptz not null default now()
);

create index if not exists products_slug_idx on public.products(slug);
create index if not exists products_active_idx on public.products(is_active) where is_active = true;
create index if not exists product_images_product_id_idx on public.product_images(product_id);

-- RLS
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "Produtos ativos sao publicos" on public.products;
create policy "Produtos ativos sao publicos"
  on public.products for select
  using (is_active = true);

drop policy if exists "Imagens de produtos ativos sao publicas" on public.product_images;
create policy "Imagens de produtos ativos sao publicas"
  on public.product_images for select
  using (
    exists (
      select 1 from public.products p
      where p.id = product_id and p.is_active = true
    )
  );

drop policy if exists "Usuario le proprio perfil" on public.profiles;
create policy "Usuario le proprio perfil"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Usuario atualiza proprio perfil" on public.profiles;
create policy "Usuario atualiza proprio perfil"
  on public.profiles for update
  using (auth.uid() = id);

drop policy if exists "Usuario insere proprio perfil" on public.profiles;
create policy "Usuario insere proprio perfil"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Cliente ve seus pedidos" on public.orders;
create policy "Cliente ve seus pedidos"
  on public.orders for select
  using (auth.uid() = user_id);

drop policy if exists "Cliente ve itens dos seus pedidos" on public.order_items;
create policy "Cliente ve itens dos seus pedidos"
  on public.order_items for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and o.user_id = auth.uid()
    )
  );

-- Perfil automático ao cadastrar (Authentication → Email)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
