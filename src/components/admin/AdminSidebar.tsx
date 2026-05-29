import { Link, useRouterState } from '@tanstack/react-router';
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Users,
  Warehouse,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/admin/produtos', label: 'Produtos', icon: Package },
  { to: '/admin/pedidos', label: 'Pedidos', icon: ShoppingBag },
  { to: '/admin/clientes', label: 'Clientes', icon: Users },
  { to: '/admin/estoque', label: 'Estoque', icon: Warehouse },
  { to: '/admin/configuracoes', label: 'Configurações', icon: Settings },
] as const;

export function AdminSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="space-y-1">
      {NAV_ITEMS.map(({ to, label, icon: Icon, exact }) => {
        const active = exact
          ? pathname === '/admin' || pathname === '/admin/'
          : pathname.startsWith(to);
        return (
          <Link
            key={to}
            to={to}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
              active
                ? 'bg-gold/15 text-gold border border-gold/30'
                : 'text-muted-foreground hover:text-foreground hover:bg-card/50',
            )}
          >
            <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
