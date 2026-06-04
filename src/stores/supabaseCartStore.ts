import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { cartLineKey } from '@/lib/product-sizes';

export type SupabaseCartItem = {
  productId: string;
  size: string;
  slug: string;
  title: string;
  priceCents: number;
  quantity: number;
  imageUrl: string | null;
  stockQuantity: number;
};

type SupabaseCartStore = {
  items: SupabaseCartItem[];
  addItem: (
    item: Omit<SupabaseCartItem, 'quantity'>,
    quantity?: number,
  ) => { ok: boolean; message?: string };
  updateQuantity: (
    productId: string,
    size: string,
    quantity: number,
  ) => { ok: boolean; message?: string };
  removeItem: (productId: string, size: string) => void;
  clearCart: () => void;
  totalCents: () => number;
};

export const useSupabaseCartStore = create<SupabaseCartStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item, quantity = 1) => {
        const key = cartLineKey(item.productId, item.size);
        const existing = get().items.find(
          (i) => cartLineKey(i.productId, i.size) === key,
        );
        const nextQty = (existing?.quantity ?? 0) + quantity;
        if (nextQty > item.stockQuantity) {
          return { ok: false, message: 'Estoque insuficiente.' };
        }
        if (existing) {
          set({
            items: get().items.map((i) =>
              cartLineKey(i.productId, i.size) === key
                ? { ...i, quantity: nextQty, stockQuantity: item.stockQuantity }
                : i,
            ),
          });
        } else {
          set({ items: [...get().items, { ...item, quantity }] });
        }
        return { ok: true };
      },

      updateQuantity: (productId, size, quantity) => {
        const key = cartLineKey(productId, size);
        if (quantity <= 0) {
          get().removeItem(productId, size);
          return { ok: true };
        }
        const item = get().items.find(
          (i) => cartLineKey(i.productId, i.size) === key,
        );
        if (!item) return { ok: false, message: 'Item não encontrado.' };
        if (quantity > item.stockQuantity) {
          return { ok: false, message: 'Estoque insuficiente.' };
        }
        set({
          items: get().items.map((i) =>
            cartLineKey(i.productId, i.size) === key ? { ...i, quantity } : i,
          ),
        });
        return { ok: true };
      },

      removeItem: (productId, size) => {
        const key = cartLineKey(productId, size);
        set({
          items: get().items.filter(
            (i) => cartLineKey(i.productId, i.size) !== key,
          ),
        });
      },

      clearCart: () => set({ items: [] }),

      totalCents: () =>
        get().items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0),
    }),
    {
      name: 'bessa-supabase-cart',
      storage: createJSONStorage(() => localStorage),
      version: 2,
      migrate: (persisted, version) => {
        const state = persisted as { items?: Array<Record<string, unknown>> };
        if (version < 2 && state?.items) {
          state.items = state.items.map((item) => ({
            ...item,
            size: typeof item.size === 'string' ? item.size : 'M',
          }));
        }
        return state as SupabaseCartStore;
      },
    },
  ),
);

export { parseVariantId as parseSupabaseVariantId } from '@/lib/product-sizes';
export { buildVariantId as supabaseVariantId } from '@/lib/product-sizes';
