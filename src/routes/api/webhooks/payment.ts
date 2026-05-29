import { createFileRoute } from '@tanstack/react-router';
import { paymentWebhookFn } from '@/lib/checkout.server';

export const Route = createFileRoute('/api/webhooks/payment')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const payload = await request.json();
          await paymentWebhookFn({ data: { payload } });
          return new Response(JSON.stringify({ received: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (error) {
          console.error('Payment webhook error:', error);
          return new Response(JSON.stringify({ error: 'Webhook failed' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      },
    },
  },
});
