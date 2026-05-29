import { createFileRoute, Link } from '@tanstack/react-router';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { Button } from '@/components/ui/button';

type PendingSearch = {
  order?: string;
};

export const Route = createFileRoute('/checkout/pending')({
  validateSearch: (search: Record<string, unknown>): PendingSearch => ({
    order: typeof search.order === 'string' ? search.order : undefined,
  }),
  component: CheckoutPendingPage,
  head: () => ({
    meta: [{ title: "Pagamento — Bessa's Box" }],
  }),
});

function CheckoutPendingPage() {
  const { order } = Route.useSearch();

  return (
    <div className="min-h-screen bg-background bg-mesh-dark">
      <SiteHeader homeOnlyNav={false} />
      <main className="pt-24 pb-16 max-w-lg mx-auto px-4 text-center space-y-6">
        <div className="premium-card rounded-xl p-10 space-y-4">
          <p className="text-gold text-xs tracking-[0.25em] uppercase">Pagamento</p>
          <h1 className="font-display text-3xl">Aguardando confirmação</h1>
          <p className="text-sm text-muted-foreground">
            Seu pedido foi registrado. Conclua o pagamento no provedor configurado (Mercado Pago ou
            Asaas). Quando o pagamento for confirmado, você receberá atualização por e-mail.
          </p>
          {order && (
            <p className="text-xs font-mono text-muted-foreground">Pedido: {order.slice(0, 8)}…</p>
          )}
          <Button asChild className="bg-gold text-onyx hover:bg-gold-soft">
            <Link to="/colecao">Continuar comprando</Link>
          </Button>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
