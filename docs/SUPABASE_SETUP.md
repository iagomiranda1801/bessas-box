# Supabase — Bessa's Box



Guia para banco, **painel admin**, login e bucket de imagens.



## Ordem no painel



1. **SQL Editor** → rodar [`supabase/schema.sql`](../supabase/schema.sql)  

   - Clique **Run and enable RLS** se aparecer o aviso.

   - **Já rodou `schema.sql` antes?** Rode de novo o arquivo inteiro **ou** só [`supabase/migrations/admin_orders.sql`](../supabase/migrations/admin_orders.sql) — o checkout precisa das colunas `shipping_name`, `shipping_address`, etc. e da tabela `order_status_history`.

2. **SQL Editor** → rodar [`supabase/storage_product_images.sql`](../supabase/storage_product_images.sql)  

   - Cria o bucket **`product-images`** (público para leitura).

3. **Authentication → Providers → Email** → ligado.

4. **Authentication → Users → Add user** → crie o usuário admin (e-mail + senha).

5. **Settings → API** → copiar URL, anon key e **service_role** para o `.env`.



---



## Variáveis de ambiente (TanStack Start + **Vite**)



No `.env` (não commitar). **Não use** `NEXT_PUBLIC_` — isso é Next.js.



```env

VITE_SUPABASE_URL=https://seu-projeto.supabase.co

VITE_SUPABASE_ANON_KEY=sb_publishable_...   # ou anon key (Settings → API)



# Só servidor — CRUD admin, upload de fotos (NUNCA VITE_)

SUPABASE_SERVICE_ROLE_KEY=eyJ...



# E-mails autorizados no painel /admin (separados por vírgula)

ADMIN_EMAILS=dono@bessasbox.com,outro@email.com



# Catálogo público: supabase (padrão se VITE_SUPABASE_URL existir) ou shopify

CATALOG_SOURCE=supabase

```



| Variável | Onde usar |

|----------|-----------|

| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Browser (login admin) + leitura pública |

| `SUPABASE_SERVICE_ROLE_KEY` | Apenas server functions (`admin.server.ts`) |

| `ADMIN_EMAILS` | Apenas servidor — quem pode acessar `/admin` |

| `CATALOG_SOURCE` | `supabase` ou `shopify` |



Reinicie `npm run dev` após alterar o `.env`.



---



## Painel admin (`/admin`)

URL discreta — **não** aparece no menu da loja. Guia completo: [`docs/ADMIN.md`](ADMIN.md).

### Migrations extras (pedidos + histórico)

Após `schema.sql`, rode:

- [`supabase/migrations/profiles.sql`](../supabase/migrations/profiles.sql) — perfil do cliente (`/conta/perfil`)
- [`supabase/migrations/admin_orders.sql`](../supabase/migrations/admin_orders.sql) — pedidos e checkout

### Acesso



1. Configure `ADMIN_EMAILS` e `SUPABASE_SERVICE_ROLE_KEY` no `.env`.

2. Crie o usuário em **Authentication → Users** (mesmo e-mail de `ADMIN_EMAILS`).

3. Abra **`/admin/login`**, entre com e-mail e senha do Supabase Auth.

4. E-mail fora de `ADMIN_EMAILS` → acesso negado (mesmo com senha correta).



### Cadastrar produto



1. **`/admin/produtos`** → **Novo produto**

2. Preencha título, preço (R$), estoque, **Ativo na loja**, **Destaque**

3. Opcional: selecione fotos na criação ou em **Editar** depois

4. Produto **ativo** aparece em **`/colecao`**; **destaque** em **`/destaques`**

5. **`is_active = false`** → some da loja, continua no admin



Upload vai para **Storage → product-images → `{slug}/...`** e grava em **`product_images`**.



### Sacola / checkout



Catálogo, sacola e checkout usam **Supabase**. Se aparecer erro de coluna (`shipping_address`, `order_status_history`), execute [`supabase/migrations/admin_orders.sql`](../supabase/migrations/admin_orders.sql) no SQL Editor.



---



## Bucket de imagens



### Jeito A — SQL (recomendado)



1. Abra **SQL Editor**.

2. Cole o conteúdo de `supabase/storage_product_images.sql`.

3. **Run**.



Confira em **Storage** → **`product-images`**.



### Jeito B — Pelo Dashboard (manual)



| Campo | Valor |

|-------|--------|

| **Bucket name** | `product-images` |

| **Public bucket** | **Ligado** |

| **Restrict file size** | Opcional — ex. 5 MB |

| **Restrict MIME types** | Opcional — `image/jpeg`, `image/png`, `image/webp` |



Depois rode as **policies** de `storage_product_images.sql` se ainda não rodou o arquivo inteiro.



---



## Subir foto manualmente (alternativa ao painel)



1. **Storage** → **product-images** → **Upload file** (ex.: `calca-jeans-lisa/foto.jpg`)

2. **Copy URL** pública

3. SQL:



```sql

insert into public.product_images (

  product_id, storage_path, public_url, alt_text, is_primary, sort_order

)

values (

  'UUID-DO-PRODUTO',

  'calca-jeans-lisa/foto.jpg',

  'https://SEU_PROJETO.supabase.co/storage/v1/object/public/product-images/calca-jeans-lisa/foto.jpg',

  'Calça Jeans Lisa',

  true,

  0

);

```



---



## Login do cliente (loja)



- Conta em **`/conta/*`** ainda usa **Shopify Customer API** (fase separada).

- **Authentication** do Supabase é usado pelo **admin** (`auth.users`).

- Tabela **`profiles`** guarda nome/telefone (opcional, futuro).



---



## Checklist rápido



- [ ] `schema.sql` executado (com RLS)
- [ ] `migrations/admin_orders.sql` executado (obrigatório para checkout / admin de pedidos)
- [ ] `migrations/profiles.sql` executado (obrigatório para `/conta/perfil`)

- [ ] `storage_product_images.sql` → bucket **product-images**

- [ ] Email auth ligado

- [ ] Usuário admin em Authentication → Users

- [ ] `.env`: `VITE_*`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAILS`, `CATALOG_SOURCE=supabase`

- [ ] Login em `/admin/login` → criar produto + foto → ver em `/colecao`



---



## Próxima fase (fora deste escopo)



- Sacola/checkout Supabase + Mercado Pago

- Migrar `/conta/*` para Supabase Auth

- Remover fallback Shopify do catálogo quando estabilizar

