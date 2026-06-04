import { Check, Copy, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PaymentStatusBadge } from '@/components/checkout/PaymentStatusBadge';
import { cn } from '@/lib/utils';

type PixPaymentPanelProps = {
  pixQrCode: string | null;
  pixCopyPaste: string | null;
  invoiceUrl?: string | null;
  expiresAt: string | null;
  isDemo?: boolean;
  status: 'awaiting' | 'paid' | 'cancelled';
  totalLabel: string;
};

export function PixPaymentPanel({
  pixQrCode,
  pixCopyPaste,
  invoiceUrl,
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

  const qrImageSrc = pixQrCode
    ? `data:image/png;base64,${pixQrCode}`
    : pixCopyPaste
      ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(pixCopyPaste)}`
      : null;

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
        {invoiceUrl && (
          <div className="w-full max-w-sm space-y-2">
            <Button
              asChild
              className="w-full bg-gold text-onyx hover:bg-gold-soft transition-all"
            >
              <a href={invoiceUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" />
                Pagar no Asaas (Pix, cartão ou boleto)
              </a>
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Você será levado à página segura do Asaas para concluir o pagamento.
              Esta tela atualiza sozinha assim que recebermos a confirmação.
            </p>
          </div>
        )}

        {qrImageSrc && (
          <div className="w-full max-w-sm flex flex-col items-center gap-4">
            {invoiceUrl && (
              <div className="flex items-center gap-3 w-full">
                <div className="h-px flex-1 bg-gold/15" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider">
                  Ou via Pix
                </span>
                <div className="h-px flex-1 bg-gold/15" />
              </div>
            )}

            <div className="p-3 rounded-xl border-2 border-gold/30 bg-white shadow-lg shadow-gold/10">
              <img
                src={qrImageSrc}
                alt="QR Code Pix"
                className="w-52 h-52 sm:w-56 sm:h-56"
              />
            </div>

            <p className="text-sm text-muted-foreground text-center max-w-xs">
              Escaneie o QR Code no app do seu banco ou copie o código Pix abaixo.
            </p>

            {pixCopyPaste && (
              <Button
                type="button"
                onClick={handleCopy}
                variant={invoiceUrl ? 'outline' : 'default'}
                className={cn(
                  'w-full transition-all',
                  invoiceUrl
                    ? 'border-gold/40'
                    : 'bg-gold text-onyx hover:bg-gold-soft',
                  copied && 'bg-emerald-600 text-white hover:bg-emerald-600 border-emerald-600',
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
          </div>
        )}

        {!invoiceUrl && !qrImageSrc && (
          <div className="w-full max-w-sm rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-100/90">
            Não foi possível carregar a cobrança. Atualize a página ou tente
            novamente em instantes.
          </div>
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
