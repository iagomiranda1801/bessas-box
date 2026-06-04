import { useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { adminDeleteOrderFn } from '@/lib/orders.server';
import { shortOrderId } from '@/lib/admin-utils';

type DeleteOrderButtonProps = {
  orderId: string;
  accessToken: string | null;
  onDeleted?: () => void;
  size?: 'sm' | 'default';
  className?: string;
};

export function DeleteOrderButton({
  orderId,
  accessToken,
  onDeleted,
  size = 'sm',
  className,
}: DeleteOrderButtonProps) {
  const [deleting, setDeleting] = useState(false);
  const [open, setOpen] = useState(false);

  const handleDelete = async () => {
    if (!accessToken) {
      toast.error('Sessão expirada. Entre novamente no admin.');
      return;
    }
    setDeleting(true);
    try {
      const result = await adminDeleteOrderFn({
        data: { accessToken, id: orderId },
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success('Pedido excluído.');
      setOpen(false);
      onDeleted?.();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={size}
          className={
            className ??
            'border-destructive/60 text-destructive hover:bg-destructive/10 shrink-0'
          }
          disabled={deleting}
          onClick={(e) => e.stopPropagation()}
        >
          {deleting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Trash2 className="w-4 h-4 mr-1.5" />
              Excluir
            </>
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="bg-background border-gold/20">
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir pedido #{shortOrderId(orderId)}?</AlertDialogTitle>
          <AlertDialogDescription>
            O pedido será removido permanentemente e o estoque dos itens será devolvido. Esta ação
            não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={deleting}
            onClick={(e) => {
              e.preventDefault();
              void handleDelete();
            }}
          >
            {deleting ? 'Excluindo…' : 'Excluir pedido'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
