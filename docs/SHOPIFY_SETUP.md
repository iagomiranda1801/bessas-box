# Configuração Shopify (checkout e catálogo)

Checklist para a loja configurada em `SHOPIFY_STORE_DOMAIN` / `VITE_SHOPIFY_STORE_DOMAIN`.

## Produtos

1. Status **Ativo**.
2. Publicados em **Loja online** e no canal **Headless** do app (mesmo token de `SHOPIFY_STOREFRONT_PRIVATE_TOKEN`).
3. **Rastrear quantidade** ligado, com estoque > 0 na **localização usada para pedidos online** (Configurações → Locais e envios).

## Loja

1. **Loja virtual → Preferências**: desativar proteção por senha antes de testar checkout.
2. Variáveis no servidor (Vercel/local): `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_STOREFRONT_PRIVATE_TOKEN` da **mesma** loja.
3. Não usar `shpat_` em `VITE_SHOPIFY_STOREFRONT_TOKEN` (só token público Headless, se necessário no cliente).

## Checkout e clientes

Para compra **sem cadastro obrigatório**:

1. **Configurações → Checkout → Contas de cliente**
   - Permitir **checkout como convidado**.
   - Conta de cliente **opcional** (não exigir login antes de pagar).
2. Se a loja usa **Novas contas de cliente** (Shopify), confirme que convidado continua permitido no checkout.
3. O site usa a API Storefront clássica (`customerCreate`, `customerAccessTokenCreate`) para login/cadastro opcional em `/conta/entrar` e `/conta/cadastro`.

### Scopes Headless (app da vitrine)

No canal Headless onde foi gerado o token, inclua permissões de cliente, por exemplo:

- `unauthenticated_write_customers`
- `unauthenticated_read_customers`

Sem esses scopes, cadastro/login no site retorna erro de permissão.

## Após trocar de loja

Limpar sacola no navegador (ou aba anônima). O site descarta carrinhos salvos de outro domínio automaticamente.
