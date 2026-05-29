import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type SupabaseCartItem = {
  productId: string;
  slug: string;
  title: string;
  priceCents: number;
  quantity: number;
  imageUrl: string | null;
  stockQuantity: number;
};

type SupabaseCartStore = {
  items: SupabaseCartItem[];
  addItem: (item: Omit<SupabaseCartItem, 'quantity'>, quantity?: number) => { ok: boolean; message?: string };
  updateQuantity: (productId: string, quantity: number) => { ok: boolean; message?: string };
  removeItem: (productId: string) => void;
  clearCart: () => void;
  totalCents: () => number;
};

export const useSupabaseCartStore = create<SupabaseCartStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item, quantity = 1) => {
        const existing = get().items.find((i) => i.productId === item.productId);
        const nextQty = (existing?.quantity ?? 0) + quantity;
        if (nextQty > item.stockQuantity) {
          return { ok: false, message: 'Estoque insuficiente.' };
        }
        if (existing) {
          set({
            items: get().items.map((i) =>
              i.productId === item.productId ? { ...i, quantity: nextQty } : i,
            ),
          });
        } else {
          set({ items: [...get().items, { ...item, quantity }] });
        }
        return { ok: true };
      },

      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId);
          return { ok: true };
        }
        const item = get().items.find((i) => i.productId === productId);
        if (!item) return { ok: false, message: 'Item não encontrado.' };
        if (quantity > item.stockQuantity) {
          return { ok: false, message: 'Estoque insuficiente.' };
        }
        set({
          items: get().items.map((i) =>
            i.productId === productId ? { ...i, quantity } : i,
          ),
        });
        return { ok: true };
      },

      removeItem: (productId) => {
        set({ items: get().items.filter((i) => i.productId !== productId) });
      },

      clearCart: () => set({ items: [] }),

      totalCents: () =>
        get().items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0),
    }),
    {
      name: 'bessa-supabase-cart',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export function supabaseVariantId(productId: string): string {
  return `supabase-variant-${productId}`;
}

export function parseSupabaseVariantId(variantId: string): string | null {
  if (!variantId.startsWith('supabase-variant-')) return null;
  return variantId.replace('supabase-variant-', '');
}
