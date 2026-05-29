import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

export type CustomerSession = {
  accessToken: string;
  email: string;
  expiresAt: string;
  userId: string;
};

interface CustomerStore {
  accessToken: string | null;
  email: string | null;
  expiresAt: string | null;
  userId: string | null;
  setSession: (session: CustomerSession) => void;
  logout: () => Promise<void>;
  isLoggedIn: () => boolean;
}

export const useCustomerStore = create<CustomerStore>()(
  persist(
    (set, get) => ({
      accessToken: null,
      email: null,
      expiresAt: null,
      userId: null,

      setSession: (session) =>
        set({
          accessToken: session.accessToken,
          email: session.email,
          expiresAt: session.expiresAt,
          userId: session.userId,
        }),

      logout: async () => {
        try {
          const supabase = getSupabaseBrowserClient();
          await supabase.auth.signOut();
        } catch (error) {
          console.error('Logout failed:', error);
        }
        set({ accessToken: null, email: null, expiresAt: null, userId: null });
      },

      isLoggedIn: () => {
        const { accessToken, expiresAt } = get();
        if (!accessToken) return false;
        if (expiresAt && new Date(expiresAt) <= new Date()) return false;
        return true;
      },
    }),
    {
      name: 'bessa-customer',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        email: state.email,
        expiresAt: state.expiresAt,
        userId: state.userId,
      }),
    },
  ),
);

export function truncateEmail(email: string, max = 22): string {
  if (email.length <= max) return email;
  const [local, domain] = email.split('@');
  if (!domain) return `${email.slice(0, max - 1)}…`;
  const keep = Math.max(3, max - domain.length - 2);
  return `${local.slice(0, keep)}…@${domain}`;
}
