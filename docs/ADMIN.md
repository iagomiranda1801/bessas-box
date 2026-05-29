# Painel Admin — Bessa's Box

Back-office em `/admin` (URL discreta, não aparece no menu da loja).

## Módulos

| Rota | Função |
|------|--------|
| `/admin` | Dashboard — KPIs, últimos pedidos |
| `/admin/produtos` | Lista, busca, toggle ativo/destaque |
| `/admin/produtos/novo` | Cadastrar produto + fotos |
| `/admin/produtos/$id` | Editar produto + fotos |
| `/admin/pedidos` | Lista de pedidos |
| `/admin/pedidos/$id` | Detalhe, itens, alterar status |
| `/admin/clientes` | Usuários Supabase Auth + perfis |
| `/admin/clientes/$id` | Perfil + histórico de pedidos |
| `/admin/estoque` | Estoque baixo, ajuste rápido |
| `/admin/configuracoes` | Fonte catálogo/sacola, pagamento, admins |

## Acesso

1. `ADMIN_EMAILS` no `.env` (servidor)
2. Usuário em **Supabase → Authentication → Users**
3. Login em `/admin/login`

## Banco (migrations)

Rodar no SQL Editor, nesta ordem:

1. [`supabase/schema.sql`](../supabase/schema.sql)
2. [`supabase/storage_product_images.sql`](../supabase/storage_product_images.sql)
3. [`supabase/migrations/admin_orders.sql`](../supabase/migrations/admin_orders.sql) — status, envio, histórico

## Checkout Supabase

Com `CATALOG_SOURCE=supabase` e `CART_SOURCE=supabase` (ou omitido — herda do catálogo):

1. Sacola local (`SupabaseCartDrawer`)
2. `createSupabaseOrderFn` grava `orders` + `order_items`, reserva estoque
3. Provedor de pagamento (`PaymentProvider`) gera cobrança
4. Webhook `POST /api/webhooks/payment` confirma pagamento

## Pagamentos (camada genérica)

Variável `PAYMENT_PROVIDER=mercadopago|asaas`.

| Provedor | Variáveis | Uso típico |
|----------|-----------|------------|
| **Mercado Pago** | `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET` | E-commerce, checkout loja |
| **Asaas** | `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN` | Cobranças, Pix, split parceiros |

Implementações atuais são **stubs** — retornam `/checkout/pending?order=...` até configurar tokens e completar API.

Arquivos:

- [`src/lib/payments/types.ts`](../src/lib/payments/types.ts)
- [`src/lib/payments/mercadopago.provider.ts`](../src/lib/payments/mercadopago.provider.ts)
- [`src/lib/payments/asaas.provider.ts`](../src/lib/payments/asaas.provider.ts)
- [`src/lib/checkout.server.ts`](../src/lib/checkout.server.ts)

## Pedido de teste (SQL)

```sql
insert into public.orders (customer_email, status, total_cents, shipping_name)
values ('cliente@teste.com', 'paid', 19990, 'Cliente Teste')
returning id;
-- use o UUID retornado:
insert into public.order_items (order_id, product_title, quantity, unit_price_cents)
values ('UUID-DO-PEDIDO', 'Produto Teste', 1, 19990);
```

## Status de pedido

`pending` → `awaiting_payment` → `paid` → `processing` → `shipped` → `delivered`  
Cancelamento: `cancelled` / `refunded`

## Sacola Shopify (legado)

Se `CART_SOURCE=shopify`, a sacola continua usando Shopify Checkout. Catálogo pode ser Supabase enquanto checkout ainda é Shopify — produtos Supabase **não** funcionam na sacola Shopify.

## Verificação

- [ ] Dashboard com KPIs
- [ ] Sidebar navega entre módulos
- [ ] CRUD produtos OK
- [ ] Pedido seed visível em `/admin/pedidos`
- [ ] Cliente Auth visível em `/admin/clientes`
- [ ] Compra teste → pedido em admin (após checkout Supabase)
