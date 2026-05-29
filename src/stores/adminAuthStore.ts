import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import { adminVerifyFn } from '@/lib/admin-auth.server';

interface AdminAuthStore {
  accessToken: string | null;
  email: string | null;
  setSession: (session: { accessToken: string; email: string }) => void;
  clearSession: () => void;
  verifySession: () => Promise<boolean>;
  signOut: () => Promise<void>;
}

export const useAdminAuthStore = create<AdminAuthStore>()(
  persist(
    (set, get) => ({
      accessToken: null,
      email: null,

      setSession: (session) =>
        set({ accessToken: session.accessToken, email: session.email }),

      clearSession: () => set({ accessToken: null, email: null }),

      verifySession: async () => {
        const token = get().accessToken;
        if (!token) return false;
        try {
          const result = await adminVerifyFn({ data: { accessToken: token } });
          if (!result.ok) {
            set({ accessToken: null, email: null });
            return false;
          }
          set({ email: result.email });
          return true;
        } catch {
          set({ accessToken: null, email: null });
          return false;
        }
      },

      signOut: async () => {
        try {
          const supabase = getSupabaseBrowserClient();
          await supabase.auth.signOut();
        } catch (error) {
          console.error('Admin signOut:', error);
        }
        set({ accessToken: null, email: null });
      },
    }),
    {
      name: 'bessa-admin-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        email: state.email,
      }),
    },
  ),
);

export async function waitForAdminAuthHydration(): Promise<void> {
  if (typeof window === 'undefined') return;
  const persistApi = useAdminAuthStore.persist;
  if (persistApi.hasHydrated()) return;
  await new Promise<void>((resolve) => {
    const unsub = persistApi.onFinishHydration(() => {
      unsub();
      resolve();
    });
  });
}

export async function requireAdminSession(): Promise<{ accessToken: string; email: string }> {
  await waitForAdminAuthHydration();
  const { accessToken, email, verifySession } = useAdminAuthStore.getState();
  if (!accessToken) throw new Error('NOT_AUTH');
  const ok = await verifySession();
  if (!ok || !email) throw new Error('NOT_AUTH');
  return { accessToken, email: useAdminAuthStore.getState().email! };
}
