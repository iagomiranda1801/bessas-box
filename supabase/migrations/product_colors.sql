-- Cores e estoque por cor × tamanho
-- SQL Editor → Run (após product_sizes.sql)

alter table public.products
  add column if not exists product_colors text[] not null default array['Padrão']::text[],
  add column if not exists variant_stock jsonb not null default '{}'::jsonb;

alter table public.order_items
  add column if not exists color text;

-- Migra size_stock existente para variant_stock sob "Padrão"
update public.products p
set
  product_colors = array['Padrão']::text[],
  variant_stock = jsonb_build_object('Padrão', coalesce(p.size_stock, '{}'::jsonb))
where p.variant_stock = '{}'::jsonb
   or p.variant_stock is null;

notify pgrst, 'reload schema';
