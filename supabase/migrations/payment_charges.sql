-- Tabela dedicada de cobranças (Asaas / futuros gateways)
create table if not exists public.payment_charges (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null default 'asaas',
  external_id text not null,
  billing_type text not null default 'PIX',
  amount_cents integer not null,
  status text not null default 'pending',
  pix_qr_code text,
  pix_copy_paste text,
  invoice_url text,
  expires_at timestamptz,
  paid_at timestamptz,
  customer_cpf text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists payment_charges_external_id_idx
  on public.payment_charges(provider, external_id);
create index if not exists payment_charges_order_id_idx
  on public.payment_charges(order_id);
create index if not exists payment_charges_status_idx
  on public.payment_charges(status);

alter table public.payment_charges enable row level security;

drop policy if exists "Cliente ve cobrancas dos seus pedidos" on public.payment_charges;
create policy "Cliente ve cobrancas dos seus pedidos"
  on public.payment_charges for select
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

notify pgrst, 'reload schema';
