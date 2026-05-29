import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import { adminVerifyFn, adminCheckEmailAllowedFn } from '@/lib/admin.server';
import { useAdminAuthStore } from '@/stores/adminAuthStore';

export const Route = createFileRoute('/admin/login')({
  component: AdminLoginPage,
  head: () => ({
    meta: [{ title: 'Admin — Login' }, { name: 'robots', content: 'noindex' }],
  }),
});

function AdminLoginPage() {
  const navigate = useNavigate();
  const setSession = useAdminAuthStore((s) => s.setSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const allowed = await adminCheckEmailAllowedFn({ data: { email: email.trim() } });
      if (!allowed.allowed) {
        toast.error('Este e-mail não está autorizado como administrador.');
        return;
      }

      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error || !data.session?.access_token) {
        toast.error(error?.message ?? 'E-mail ou senha incorretos.');
        return;
      }

      const verified = await adminVerifyFn({
        data: { accessToken: data.session.access_token },
      });

      if (!verified.ok) {
        await supabase.auth.signOut();
        toast.error(verified.message);
        return;
      }

      setSession({
        accessToken: data.session.access_token,
        email: verified.email,
      });
      toast.success('Bem-vindo ao painel.');
      navigate({ to: '/admin' });
    } catch {
      toast.error('Não foi possível entrar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background bg-mesh-dark flex items-center justify-center px-4">
      <div className="premium-card rounded-xl p-8 w-full max-w-md space-y-6">
        <div className="space-y-1 text-center">
          <p className="text-gold text-xs tracking-[0.25em] uppercase">Admin</p>
          <h1 className="font-display text-3xl">Entrar</h1>
          <p className="text-sm text-muted-foreground">
            Use o e-mail cadastrado em ADMIN_EMAILS e sua senha do Supabase Auth.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="admin-email" className="text-sm">
              E-mail
            </label>
            <Input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="border-gold/30"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="admin-password" className="text-sm">
              Senha
            </label>
            <Input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="border-gold/30"
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-gold text-onyx hover:bg-gold-soft"
          >
            {loading ? 'Entrando…' : 'Entrar no painel'}
          </Button>
        </form>
        <Button asChild variant="ghost" className="w-full">
          <Link to="/">Voltar à loja</Link>
        </Button>
      </div>
    </div>
  );
}
