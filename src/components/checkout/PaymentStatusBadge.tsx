import { cn } from '@/lib/utils';

type PaymentStatusBadgeProps = {
  status: 'awaiting' | 'paid' | 'cancelled';
  className?: string;
};

const LABELS = {
  awaiting: 'Aguardando pagamento',
  paid: 'Pago',
  cancelled: 'Cancelado',
} as const;

const STYLES = {
  awaiting: 'bg-amber-500/15 text-amber-200 border-amber-500/40 animate-pulse',
  paid: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/40',
  cancelled: 'bg-red-500/15 text-red-200 border-red-500/40',
} as const;

export function PaymentStatusBadge({ status, className }: PaymentStatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center text-xs px-2.5 py-1 rounded-full border font-medium',
        STYLES[status],
        className,
      )}
    >
      {LABELS[status]}
    </span>
  );
}
