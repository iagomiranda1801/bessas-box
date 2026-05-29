-- Tabela profiles + RLS + trigger (rode se aparecer "profiles not in schema cache")
-- SQL Editor → Run

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

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

notify pgrst, 'reload schema';
