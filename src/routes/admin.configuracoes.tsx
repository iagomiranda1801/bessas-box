import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { adminSettingsFn } from '@/lib/checkout.server';
import { useAdminAuthStore } from '@/stores/adminAuthStore';

export const Route = createFileRoute('/admin/configuracoes')({
  component: AdminSettingsPage,
  head: () => ({
    meta: [{ title: 'Admin — Configurações' }, { name: 'robots', content: 'noindex' }],
  }),
});

type Settings = {
  catalogSource: string;
  cartSource: string;
  paymentProvider: string;
  adminEmailsMasked: string;
  hasMercadoPago: boolean;
  hasAsaas: boolean;
};

function AdminSettingsPage() {
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!accessToken) {
        setLoading(false);
        return;
      }
      const result = await adminSettingsFn({ data: { accessToken } });
      if (!cancelled && result.ok) setSettings(result);
      if (!cancelled) setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  return (
    <AdminLayout title="Configurações" breadcrumb="Sistema">
      {loading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : (
        <div className="premium-card rounded-xl p-6 space-y-4 max-w-xl">
          <Row label="Catálogo" value={settings?.catalogSource ?? '—'} />
          <Row label="Sacola / checkout" value={settings?.cartSource ?? '—'} />
          <Row label="Provedor de pagamento" value={settings?.paymentProvider ?? '—'} />
          <Row label="Mercado Pago configurado" value={settings?.hasMercadoPago ? 'Sim' : 'Não'} />
          <Row label="Asaas configurado" value={settings?.hasAsaas ? 'Sim' : 'Não'} />
          <Row label="Admins autorizados" value={settings?.adminEmailsMasked || '—'} />
          <p className="text-xs text-muted-foreground pt-4 border-t border-gold/10">
            Variáveis no <code className="text-gold">.env</code> do servidor. Reinicie{' '}
            <code className="text-gold">npm run dev</code> após alterar. Docs:{' '}
            <span className="text-gold">docs/ADMIN.md</span> no repositório
          </p>
        </div>
      )}
    </AdminLayout>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm py-2 border-b border-gold/10 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-right">{value}</span>
    </div>
  );
}
