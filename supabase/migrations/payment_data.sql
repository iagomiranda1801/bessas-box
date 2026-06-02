alter table public.orders
  add column if not exists customer_cpf text;

notify pgrst, 'reload schema';
