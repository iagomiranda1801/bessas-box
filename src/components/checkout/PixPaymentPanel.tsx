import { Check, Copy, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PaymentStatusBadge } from '@/components/checkout/PaymentStatusBadge';
import { cn } from '@/lib/utils';

type PixPaymentPanelProps = {
  pixQrCode: string | null;
  pixCopyPaste: string | null;
  expiresAt: string | null;
  isDemo?: boolean;
  status: 'awaiting' | 'paid' | 'cancelled';
  totalLabel: string;
};

export function PixPaymentPanel({
  pixQrCode,
  pixCopyPaste,
  expiresAt,
  isDemo,
  status,
  totalLabel,
}: PixPaymentPanelProps) {
  const [copied, setCopied] = useState(false);
  const [remaining, setRemaining] = useState<string | null>(null);

  useEffect(() => {
    if (!expiresAt || status !== 'awaiting') {
      setRemaining(null);
      return;
    }

    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining('Expirado');
        return;
      }
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setRemaining(`${hours}h ${minutes}m ${seconds}s`);
    };

    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [expiresAt, status]);

  const handleCopy = async () => {
    if (!pixCopyPaste) return;
    try {
      await navigator.clipboard.writeText(pixCopyPaste);
      setCopied(true);
      toast.success('Código Pix copiado!', { position: 'top-center' });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Não foi possível copiar.', { position: 'top-center' });
    }
  };

  if (status === 'paid') {
    return (
      <div className="text-center space-y-4 py-6 animate-fade-in-up">
        <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <Check className="w-8 h-8 text-emerald-400" />
        </div>
        <div>
          <p className="font-display text-2xl text-gold">Pagamento confirmado!</p>
          <p className="text-sm text-muted-foreground mt-1">Seu pedido está sendo processado.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="font-display text-xl">{totalLabel}</p>
        <PaymentStatusBadge status={status} />
      </div>

      {isDemo && (
        <p className="text-xs text-amber-200/90 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">
          Modo demonstração — configure ASAAS_API_KEY para cobranças reais.
        </p>
      )}

      <div className="flex flex-col items-center gap-4">
        {pixQrCode ? (
          <div className="p-3 rounded-xl border-2 border-gold/30 bg-white shadow-lg shadow-gold/10">
            <img
              src={`data:image/png;base64,${pixQrCode}`}
              alt="QR Code Pix"
              className="w-52 h-52 sm:w-56 sm:h-56"
            />
          </div>
        ) : (
          <div className="w-52 h-52 sm:w-56 sm:h-56 rounded-xl border-2 border-dashed border-gold/30 flex items-center justify-center bg-gold/5">
            <Loader2 className="w-8 h-8 animate-spin text-gold/60" />
          </div>
        )}

        <p className="text-sm text-muted-foreground text-center max-w-xs">
          Escaneie o QR Code no app do seu banco ou copie o código Pix abaixo.
        </p>

        {pixCopyPaste && (
          <Button
            type="button"
            onClick={handleCopy}
            className={cn(
              'w-full max-w-sm bg-gold text-onyx hover:bg-gold-soft transition-all',
              copied && 'bg-emerald-600 text-white hover:bg-emerald-600',
            )}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Copiado!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" />
                Copiar código Pix
              </>
            )}
          </Button>
        )}

        {remaining && (
          <p className="text-xs text-muted-foreground">
            Expira em <span className="text-gold font-medium">{remaining}</span>
          </p>
        )}
      </div>
    </div>
  );
}
