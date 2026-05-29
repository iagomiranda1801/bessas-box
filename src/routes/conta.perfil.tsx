import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { AccountShell } from '@/components/AccountShell';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  customerGetProfileFn,
  customerUpdateProfileFn,
  type CustomerProfile,
} from '@/lib/customer.server';
import { formatDate } from '@/lib/admin-utils';
import { useCustomerStore } from '@/stores/customerStore';

const profileSchema = z.object({
  fullName: z.string().min(1, 'Informe seu nome').max(100),
  phone: z.string().max(30).optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export const Route = createFileRoute('/conta/perfil')({
  component: CustomerProfilePage,
  head: () => ({
    meta: [
      { title: "Meu perfil — Bessa's Box" },
      { name: 'description', content: 'Gerencie seus dados na Bessa\'s Box.' },
    ],
  }),
});

function CustomerProfilePage() {
  const accessToken = useCustomerStore((s) => s.accessToken);
  const email = useCustomerStore((s) => s.email);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dbSetupNeeded, setDbSetupNeeded] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: '', phone: '' },
  });

  useEffect(() => {
    if (!accessToken) return;

    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const result = await customerGetProfileFn({ data: { accessToken } });
      if (cancelled) return;
      if (!result.ok) {
        setError(result.message);
        setLoading(false);
        return;
      }
      setProfile(result.profile);
      setDbSetupNeeded('profilesTableMissing' in result && result.profilesTableMissing === true);
      form.reset({
        fullName: result.profile.fullName ?? '',
        phone: result.profile.phone ?? '',
      });
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken, form]);

  const onSubmit = async (values: ProfileFormValues) => {
    if (!accessToken) return;

    const result = await customerUpdateProfileFn({
      data: {
        accessToken,
        fullName: values.fullName,
        phone: values.phone,
      },
    });
    if (!result.ok) {
      toast.error(result.message, { position: 'top-center' });
      return;
    }
    setProfile((prev) =>
      prev
        ? { ...prev, fullName: result.profile.fullName, phone: result.profile.phone }
        : result.profile,
    );
    if ('profilesTableMissing' in result && result.profilesTableMissing) {
      setDbSetupNeeded(true);
      toast.success('Dados salvos na conta (modo temporário).', { position: 'top-center' });
    } else {
      setDbSetupNeeded(false);
      toast.success('Perfil atualizado!', { position: 'top-center' });
    }
  };

  return (
    <AccountShell
      title="Meu perfil"
      description="Seus dados para entrega e contato."
      returnTo="/conta/perfil"
    >
      {loading ? (
        <p className="text-muted-foreground text-sm">Carregando perfil…</p>
      ) : error ? (
        <div className="premium-card rounded-xl p-6 text-center">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      ) : (
        <div className="premium-card rounded-xl p-6 sm:p-8 space-y-6">
          {dbSetupNeeded && (
            <p className="text-xs text-amber-200/90 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">
              A tabela <code className="text-amber-100">profiles</code> ainda não existe no Supabase. Rode{' '}
              <code className="text-amber-100">supabase/migrations/profiles.sql</code> no SQL Editor e recarregue o
              schema cache (Settings → API).
            </p>
          )}
          <div className="space-y-1 text-sm">
            <p className="text-muted-foreground">E-mail</p>
            <p className="font-medium">{profile?.email ?? email}</p>
            <p className="text-xs text-muted-foreground">O e-mail não pode ser alterado aqui.</p>
          </div>

          {profile?.memberSince && (
            <div className="space-y-1 text-sm">
              <p className="text-muted-foreground">Cliente desde</p>
              <p>{formatDate(profile.memberSince)}</p>
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome completo</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Seu nome"
                        className="border-gold/30"
                        autoComplete="name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone (opcional)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="tel"
                        placeholder="(00) 00000-0000"
                        className="border-gold/30"
                        autoComplete="tel"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                className="w-full bg-gold text-onyx hover:bg-gold-soft font-medium"
              >
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                    Salvando…
                  </>
                ) : (
                  'Salvar alterações'
                )}
              </Button>
            </form>
          </Form>
        </div>
      )}
    </AccountShell>
  );
}
