import type { OrderStatus } from '@/lib/order-types';
import { ORDER_STATUS_LABELS } from '@/lib/order-types';
import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending: 'bg-muted text-muted-foreground',
  awaiting_payment: 'bg-amber-500/20 text-amber-200 border-amber-500/40',
  paid: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40',
  processing: 'bg-blue-500/20 text-blue-200 border-blue-500/40',
  shipped: 'bg-violet-500/20 text-violet-200 border-violet-500/40',
  delivered: 'bg-gold/20 text-gold border-gold/40',
  cancelled: 'bg-red-500/20 text-red-200 border-red-500/40',
  refunded: 'bg-orange-500/20 text-orange-200 border-orange-500/40',
};

type OrderStatusBadgeProps = {
  status: OrderStatus;
  className?: string;
};

export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex text-xs px-2 py-0.5 rounded border font-medium',
        STATUS_STYLES[status] ?? STATUS_STYLES.pending,
        className,
      )}
    >
      {ORDER_STATUS_LABELS[status] ?? status}
    </span>
  );
}
