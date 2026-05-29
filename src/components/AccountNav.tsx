import { Link, useRouterState } from '@tanstack/react-router';
import { cn } from '@/lib/utils';

const TABS = [
  { to: '/conta/perfil', label: 'Perfil' },
  { to: '/conta/pedidos', label: 'Meus pedidos' },
] as const;

type AccountNavProps = {
  className?: string;
};

export function AccountNav({ className }: AccountNavProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      className={cn('flex gap-1 p-1 rounded-lg border border-gold/20 bg-secondary/20', className)}
      aria-label="Área da conta"
    >
      {TABS.map((tab) => {
        const active =
          pathname === tab.to || (tab.to === '/conta/pedidos' && pathname.startsWith('/conta/pedidos'));
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={cn(
              'flex-1 text-center text-sm font-medium py-2.5 px-3 rounded-md transition-colors',
              active
                ? 'bg-gold text-onyx shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-gold/10',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
