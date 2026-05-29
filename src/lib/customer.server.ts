import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import type { OrderRow } from '@/lib/order-types';
import { getSupabaseAnonServerClient, getSupabaseServiceClient } from '@/lib/supabase-server';

const accessTokenSchema = z.object({
  accessToken: z.string().min(1),
});

const orderSelect = `
  *,
  order_items (*)
`;

export type CustomerAuthResult =
  | { ok: true; userId: string; email: string }
  | { ok: false; message: string };

export async function requireCustomer(accessToken: string): Promise<CustomerAuthResult> {
  const client = getSupabaseAnonServerClient();
  const { data, error } = await client.auth.getUser(accessToken);

  if (error || !data.user?.email) {
    return { ok: false, message: 'Sessão inválida ou expirada. Entre novamente em /conta/entrar.' };
  }

  return { ok: true, userId: data.user.id, email: data.user.email };
}

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
      const admin = getSupabaseServiceClient();
      const name = data.firstName.trim();
      const { error: profileError } = await admin
        .from('profiles')
        .update({ full_name: name, updated_at: new Date().toISOString() })
        .eq('id', authData.user.id);
      if (profileError && PROFILES_SCHEMA_ERROR.test(profileError.message)) {
        await admin.auth.admin
          .updateUserById(authData.user.id, { user_metadata: { full_name: name } })
          .catch(() => undefined);
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
  .inputValidator(accessTokenSchema)
  .handler(async () => {
    // Sessão é encerrada no browser via supabase.auth.signOut()
    return { ok: true as const };
  });

export const customerListOrdersFn = createServerFn({ method: 'POST' })
  .inputValidator(accessTokenSchema)
  .handler(async ({ data }) => {
    const auth = await requireCustomer(data.accessToken);
    if (!auth.ok) return auth;

    const client = getSupabaseServiceClient();
    const email = auth.email.trim();
    const { data: rows, error } = await client
      .from('orders')
      .select(orderSelect)
      .or(`user_id.eq.${auth.userId},customer_email.eq.${email}`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) return { ok: false as const, message: error.message };
    return { ok: true as const, orders: (rows ?? []) as OrderRow[] };
  });

export type CustomerProfile = {
  email: string;
  fullName: string | null;
  phone: string | null;
  memberSince: string | null;
};

const PROFILES_SCHEMA_ERROR = /profiles.*schema cache|table ['"]?public\.profiles/i;

function profilesSchemaHint(message: string) {
  return PROFILES_SCHEMA_ERROR.test(message)
    ? ' Crie a tabela: no Supabase → SQL Editor, execute supabase/migrations/profiles.sql e depois Settings → API → Reload schema cache.'
    : '';
}

function profileFromUserMetadata(user: {
  user_metadata?: Record<string, unknown>;
  created_at?: string;
}): Pick<CustomerProfile, 'fullName' | 'phone' | 'memberSince'> {
  const meta = user.user_metadata ?? {};
  return {
    fullName: typeof meta.full_name === 'string' ? meta.full_name : null,
    phone: typeof meta.phone === 'string' ? meta.phone : null,
    memberSince: user.created_at ?? null,
  };
}

const updateProfileSchema = accessTokenSchema.extend({
  fullName: z.string().min(1, 'Informe seu nome').max(100),
  phone: z.string().max(30).optional(),
});

export const customerGetProfileFn = createServerFn({ method: 'POST' })
  .inputValidator(accessTokenSchema)
  .handler(async ({ data }) => {
    const auth = await requireCustomer(data.accessToken);
    if (!auth.ok) return auth;

    const { data: userData, error: userError } = await getSupabaseAnonServerClient().auth.getUser(
      data.accessToken,
    );
    if (userError || !userData.user) {
      return { ok: false as const, message: 'Sessão inválida ou expirada.' };
    }

    const fromMeta = profileFromUserMetadata(userData.user);
    const client = getSupabaseServiceClient();
    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('full_name, phone, created_at')
      .eq('id', auth.userId)
      .maybeSingle();

    if (profileError) {
      if (PROFILES_SCHEMA_ERROR.test(profileError.message)) {
        return {
          ok: true as const,
          profile: {
            email: auth.email,
            ...fromMeta,
          } satisfies CustomerProfile,
          profilesTableMissing: true as const,
        };
      }
      return { ok: false as const, message: profileError.message };
    }

    return {
      ok: true as const,
      profile: {
        email: auth.email,
        fullName: profile?.full_name ?? fromMeta.fullName,
        phone: profile?.phone ?? fromMeta.phone,
        memberSince: profile?.created_at ?? fromMeta.memberSince,
      } satisfies CustomerProfile,
    };
  });

export const customerUpdateProfileFn = createServerFn({ method: 'POST' })
  .inputValidator(updateProfileSchema)
  .handler(async ({ data }) => {
    const auth = await requireCustomer(data.accessToken);
    if (!auth.ok) return auth;

    const client = getSupabaseServiceClient();
    const fullName = data.fullName.trim();
    const phone = data.phone?.trim() || null;
    const now = new Date().toISOString();

    const { error } = await client.from('profiles').upsert(
      {
        id: auth.userId,
        full_name: fullName,
        phone,
        updated_at: now,
      },
      { onConflict: 'id' },
    );

    if (error && PROFILES_SCHEMA_ERROR.test(error.message)) {
      const { error: metaError } = await client.auth.admin.updateUserById(auth.userId, {
        user_metadata: { full_name: fullName, phone: phone ?? '' },
      });
      if (metaError) {
        return {
          ok: false as const,
          message: metaError.message + profilesSchemaHint(error.message),
        };
      }
      return {
        ok: true as const,
        profile: {
          email: auth.email,
          fullName,
          phone,
          memberSince: null,
        } satisfies CustomerProfile,
        profilesTableMissing: true as const,
      };
    }

    if (error) {
      return { ok: false as const, message: error.message + profilesSchemaHint(error.message) };
    }

    await client.auth.admin
      .updateUserById(auth.userId, { user_metadata: { full_name: fullName, phone: phone ?? '' } })
      .catch(() => undefined);

    const { data: profile } = await client
      .from('profiles')
      .select('created_at')
      .eq('id', auth.userId)
      .maybeSingle();

    return {
      ok: true as const,
      profile: {
        email: auth.email,
        fullName,
        phone,
        memberSince: profile?.created_at ?? null,
      } satisfies CustomerProfile,
    };
  });

export const customerGetOrderFn = createServerFn({ method: 'POST' })
  .inputValidator(accessTokenSchema.extend({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const auth = await requireCustomer(data.accessToken);
    if (!auth.ok) return auth;

    const client = getSupabaseServiceClient();
    const email = auth.email.trim();
    const { data: order, error } = await client
      .from('orders')
      .select(orderSelect)
      .eq('id', data.id)
      .or(`user_id.eq.${auth.userId},customer_email.eq.${email}`)
      .maybeSingle();

    if (error || !order) {
      return { ok: false as const, message: error?.message ?? 'Pedido não encontrado.' };
    }

    const { data: history } = await client
      .from('order_status_history')
      .select('status, created_at, changed_by')
      .eq('order_id', data.id)
      .order('created_at', { ascending: true });

    return {
      ok: true as const,
      order: order as OrderRow,
      history: history ?? [],
    };
  });
