import { Link, useNavigate } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { Button } from '@/components/ui/button';
import { useAdminAuthStore } from '@/stores/adminAuthStore';

type AdminLayoutProps = {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  breadcrumb?: string;
};

export function AdminLayout({ title, children, actions, breadcrumb }: AdminLayoutProps) {
  const navigate = useNavigate();
  const email = useAdminAuthStore((s) => s.email);
  const signOut = useAdminAuthStore((s) => s.signOut);

  return (
    <div className="min-h-screen bg-background text-foreground bg-mesh-dark flex">
      <aside className="hidden md:flex w-56 shrink-0 border-r border-gold/20 bg-card/20 flex-col">
        <div className="p-5 border-b border-gold/20">
          <p className="text-gold text-xs tracking-[0.25em] uppercase">Bessa&apos;s Box</p>
          <p className="font-display text-lg mt-1">Admin</p>
        </div>
        <div className="p-3 flex-1">
          <AdminSidebar />
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="border-b border-gold/20 bg-card/30 sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              {breadcrumb && (
                <p className="text-xs text-muted-foreground mb-0.5">{breadcrumb}</p>
              )}
              <h1 className="font-display text-2xl">{title}</h1>
            </div>
            <div className="flex items-center gap-3">
              {email && (
                <span className="text-xs text-muted-foreground hidden sm:inline">{email}</span>
              )}
              <Button asChild variant="outline" size="sm" className="border-gold/40">
                <Link to="/">Ver loja</Link>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-gold"
                onClick={async () => {
                  await signOut();
                  navigate({ to: '/admin/login' });
                }}
              >
                Sair
              </Button>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6 w-full flex-1">
          <div className="md:hidden premium-card rounded-lg p-3">
            <AdminSidebar />
          </div>
          {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
          {children}
        </main>
      </div>
    </div>
  );
}
