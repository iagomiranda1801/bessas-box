import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { getSupabaseAnonServerClient, getSupabaseServiceClient } from '@/lib/supabase-server';

const emailSchema = z.string().email('E-mail inválido');
const passwordSchema = z.string().min(6, 'A senha deve ter pelo menos 6 caracteres');

const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: z.string().max(100).optional(),
  acceptsMarketing: z.boolean().optional(),
});

const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export type CustomerSession = {
  accessToken: string;
  email: string;
  expiresAt: string;
  userId: string;
};

function mapSession(
  session: { access_token: string; expires_at?: number },
  email: string,
  userId: string,
): CustomerSession {
  return {
    accessToken: session.access_token,
    email,
    userId,
    expiresAt: new Date((session.expires_at ?? 0) * 1000).toISOString(),
  };
}

export const customerRegisterFn = createServerFn({ method: 'POST' })
  .inputValidator(registerSchema)
  .handler(async ({ data }) => {
    const client = getSupabaseAnonServerClient();
    const { data: authData, error } = await client.auth.signUp({
      email: data.email.trim(),
      password: data.password,
      options: {
        data: {
          full_name: data.firstName?.trim() ?? '',
          accepts_marketing: data.acceptsMarketing ?? false,
        },
      },
    });

    if (error) {
      return { ok: false as const, message: error.message };
    }

    if (!authData.user) {
      return { ok: false as const, message: 'Não foi possível criar a conta.' };
    }

    if (data.firstName?.trim()) {
      try {
        const admin = getSupabaseServiceClient();
        await admin
          .from('profiles')
          .update({ full_name: data.firstName.trim(), updated_at: new Date().toISOString() })
          .eq('id', authData.user.id);
      } catch {
        // perfil pode ser criado pelo trigger; ignorar falha não crítica
      }
    }

    if (!authData.session) {
      return {
        ok: true as const,
        needsConfirmation: true as const,
        message:
          'Conta criada! Confirme seu e-mail (link enviado pelo Supabase) e depois entre em /conta/entrar.',
      };
    }

    return {
      ok: true as const,
      needsConfirmation: false as const,
      session: mapSession(
        authData.session,
        authData.user.email ?? data.email,
        authData.user.id,
      ),
    };
  });

export const customerLoginFn = createServerFn({ method: 'POST' })
  .inputValidator(loginSchema)
  .handler(async ({ data }) => {
    const client = getSupabaseAnonServerClient();
    const { data: authData, error } = await client.auth.signInWithPassword({
      email: data.email.trim(),
      password: data.password,
    });

    if (error || !authData.session || !authData.user) {
      return {
        ok: false as const,
        message: error?.message ?? 'E-mail ou senha incorretos.',
      };
    }

    return {
      ok: true as const,
      session: mapSession(
        authData.session,
        authData.user.email ?? data.email,
        authData.user.id,
      ),
    };
  });

export const customerLogoutFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ accessToken: z.string().min(1) }))
  .handler(async () => {
    // Sessão é encerrada no browser via supabase.auth.signOut()
    return { ok: true as const };
  });
