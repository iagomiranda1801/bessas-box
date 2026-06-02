import { createFileRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';

type PendingSearch = {
  order?: string;
};

export const Route = createFileRoute('/checkout/pending')({
  validateSearch: (search: Record<string, unknown>): PendingSearch => ({
    order: typeof search.order === 'string' ? search.order : undefined,
  }),
  beforeLoad: ({ search }) => {
    if (search.order && z.string().uuid().safeParse(search.order).success) {
      throw redirect({ to: '/checkout/pagar/$orderId', params: { orderId: search.order } });
    }
  },
  component: CheckoutPendingFallback,
  head: () => ({
    meta: [{ title: "Pagamento — Bessa's Box" }],
  }),
});

function CheckoutPendingFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <p className="text-sm text-muted-foreground">Pedido não encontrado.</p>
    </div>
  );
}
