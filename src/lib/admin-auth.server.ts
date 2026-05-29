import { z } from 'zod';
import { createServerFn } from '@tanstack/react-start';
import { getAdminEmails } from '@/lib/catalog-config';
import { getSupabaseAnonServerClient } from '@/lib/supabase-server';

export type AdminAuthResult =
  | { ok: true; email: string }
  | { ok: false; message: string };

export const accessTokenSchema = z.object({
  accessToken: z.string().min(1),
});

export async function verifyAdminAccessToken(accessToken: string): Promise<AdminAuthResult> {
  const allowed = getAdminEmails();
  if (allowed.length === 0) {
    return { ok: false, message: 'ADMIN_EMAILS não configurado no servidor.' };
  }

  const client = getSupabaseAnonServerClient();
  const { data, error } = await client.auth.getUser(accessToken);

  if (error || !data.user?.email) {
    return { ok: false, message: 'Sessão inválida ou expirada.' };
  }

  const email = data.user.email.toLowerCase();
  if (!allowed.includes(email)) {
    return { ok: false, message: 'Este e-mail não tem permissão de administrador.' };
  }

  return { ok: true, email };
}

export async function requireAdmin(accessToken: string) {
  const auth = await verifyAdminAccessToken(accessToken);
  if (!auth.ok) throw new Error(auth.message);
  return auth;
}

export const adminVerifyFn = createServerFn({ method: 'POST' })
  .inputValidator(accessTokenSchema)
  .handler(async ({ data }) => verifyAdminAccessToken(data.accessToken));

export const adminCheckEmailAllowedFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ email: z.string().email() }))
  .handler(async ({ data }) => {
    const allowed = getAdminEmails();
    return { allowed: allowed.includes(data.email.toLowerCase()) };
  });
