import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { customerLogoutFn } from '@/lib/customer.server';

interface CustomerStore {
  accessToken: string | null;
  email: string | null;
  expiresAt: string | null;
  setSession: (session: { accessToken: string; email: string; expiresAt: string }) => void;
  logout: () => Promise<void>;
  isLoggedIn: () => boolean;
}

export const useCustomerStore = create<CustomerStore>()(
  persist(
    (set, get) => ({
      accessToken: null,
      email: null,
      expiresAt: null,

      setSession: (session) =>
        set({
          accessToken: session.accessToken,
          email: session.email,
          expiresAt: session.expiresAt,
        }),

      logout: async () => {
        const token = get().accessToken;
        if (token) {
          try {
            await customerLogoutFn({ data: { accessToken: token } });
          } catch (error) {
            console.error('Logout failed:', error);
          }
        }
        set({ accessToken: null, email: null, expiresAt: null });
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
