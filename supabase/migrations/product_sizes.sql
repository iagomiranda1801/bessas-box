-- Grades de tamanho por tipo de produto
-- SQL Editor → Run

alter table public.products
  add column if not exists product_category text not null default 'camiseta',
  add column if not exists size_profile text not null default 'apparel',
  add column if not exists size_stock jsonb not null default '{}'::jsonb;

alter table public.order_items
  add column if not exists size text;

-- Migra produtos existentes: categoria por título + estoque no primeiro tamanho da grade
update public.products p
set
  product_category = case
    when lower(p.title) ~ 't[eê]nis|sneaker|tenis' then 'tenis'
    when lower(p.title) ~ 'bon[eé]|bone|cap' then 'bone'
    when lower(p.title) ~ 'jeans|cal[cç]a' then 'calca_jeans'
    when lower(p.title) ~ 'polo' then 'polo'
    when lower(p.title) ~ 'short' then 'shorts'
    else 'camiseta'
  end,
  size_profile = case
    when lower(p.title) ~ 't[eê]nis|sneaker|tenis' then 'shoe'
    when lower(p.title) ~ 'bon[eé]|bone|cap' then 'one_size'
    when lower(p.title) ~ 'jeans|cal[cç]a' then 'jeans'
    else 'apparel'
  end
where p.size_stock = '{}'::jsonb or p.size_stock is null;

update public.products p
set size_stock = case p.size_profile
  when 'shoe' then jsonb_build_object('38', p.stock_quantity)
  when 'jeans' then jsonb_build_object('38', p.stock_quantity)
  when 'one_size' then jsonb_build_object('Único', p.stock_quantity)
  else jsonb_build_object('M', p.stock_quantity)
end
where p.size_stock = '{}'::jsonb or p.size_stock is null;

notify pgrst, 'reload schema';
