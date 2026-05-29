# Supabase — Storage: bucket de imagens dos produtos
# Rode no SQL Editor do painel Supabase (pode rodar depois do schema.sql)

-- Bucket público para fotos dos produtos (leitura no site)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Qualquer visitante pode VER as imagens (catálogo no site)
create policy "Leitura publica product-images"
  on storage.objects for select
  to public
  using (bucket_id = 'product-images');

-- Upload pelo Dashboard Supabase usa service_role (ignora RLS).
-- Quando tiver /admin no site, uploads vão via server function com SERVICE_ROLE_KEY.
