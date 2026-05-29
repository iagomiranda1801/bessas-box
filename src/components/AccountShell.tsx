import { Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { AccountNav } from '@/components/AccountNav';
import { useRequireCustomer } from '@/hooks/useRequireCustomer';
import { cn } from '@/lib/utils';

type AccountShellProps = {
  title: string;
  description?: string;
  returnTo: string;
  children: React.ReactNode;
  className?: string;
};

export function AccountShell({ title, description, returnTo, children, className }: AccountShellProps) {
  const { ready } = useRequireCustomer(returnTo);

  if (!ready) return null;

  return (
    <div className="min-h-screen bg-background text-foreground bg-mesh-dark">
      <SiteHeader homeOnlyNav={false} />

      <main className="pt-20 pb-0">
        <div className={cn('max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-16', className)}>
          <Link
            to="/colecao"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-gold mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Voltar à loja
          </Link>

          <div className="space-y-2 mb-6">
            <p className="text-gold text-xs tracking-[0.25em] uppercase">Conta</p>
            <h1 className="font-display text-3xl sm:text-4xl">{title}</h1>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>

          <AccountNav className="mb-8" />

          {children}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
