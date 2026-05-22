import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ShopifyProduct } from '@/lib/shopify';
import {
  cartAddLineFn,
  cartCreateFn,
  cartRemoveLineFn,
  cartSyncFn,
  cartUpdateLineFn,
} from '@/lib/cart.server';

export interface CartItem {
  lineId: string | null;
  product: ShopifyProduct;
  variantId: string;
  variantTitle: string;
  price: { amount: string; currencyCode: string };
  quantity: number;
  selectedOptions: Array<{ name: string; value: string }>;
}

export type AddItemResult =
  | { ok: true }
  | { ok: false; message: string };

interface CartStore {
  items: CartItem[];
  cartId: string | null;
  checkoutUrl: string | null;
  isLoading: boolean;
  isSyncing: boolean;
  addItem: (item: Omit<CartItem, 'lineId'>) => Promise<AddItemResult>;
  updateQuantity: (variantId: string, quantity: number) => Promise<boolean>;
  removeItem: (variantId: string) => Promise<boolean>;
  clearCart: () => void;
  syncCart: () => Promise<void>;
  getCheckoutUrl: () => string | null;
}

const ADD_ITEM_ERROR = 'Não foi possível adicionar à sacola. Tente novamente.';

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      cartId: null,
      checkoutUrl: null,
      isLoading: false,
      isSyncing: false,

      addItem: async (item) => {
        const { items, cartId, clearCart } = get();
        const existingItem = items.find((i) => i.variantId === item.variantId);
        set({ isLoading: true });
        try {
          if (!cartId) {
            const result = await cartCreateFn({
              data: { variantId: item.variantId, quantity: item.quantity },
            });
            if (result.ok) {
              set({
                cartId: result.cartId,
                checkoutUrl: result.checkoutUrl,
                items: [{ ...item, lineId: result.lineId }],
              });
              return { ok: true };
            }
            return { ok: false, message: result.message || ADD_ITEM_ERROR };
          }

          if (existingItem) {
            const newQuantity = existingItem.quantity + item.quantity;
            if (!existingItem.lineId) {
              return { ok: false, message: ADD_ITEM_ERROR };
            }
            const result = await cartUpdateLineFn({
              data: {
                cartId,
                lineId: existingItem.lineId,
                quantity: newQuantity,
              },
            });
            if (result.ok) {
              set({
                items: items.map((i) =>
                  i.variantId === item.variantId ? { ...i, quantity: newQuantity } : i,
                ),
              });
              return { ok: true };
            }
            if (result.cartNotFound) clearCart();
            return { ok: false, message: result.message || ADD_ITEM_ERROR };
          }

          const result = await cartAddLineFn({
            data: {
              cartId,
              variantId: item.variantId,
              quantity: item.quantity,
            },
          });
          if (result.ok) {
            set({
              items: [...items, { ...item, lineId: result.lineId }],
            });
            return { ok: true };
          }
          if (result.cartNotFound) clearCart();
          return { ok: false, message: result.message || ADD_ITEM_ERROR };
        } catch (error) {
          console.error('Failed to add item:', error);
          return { ok: false, message: ADD_ITEM_ERROR };
        } finally {
          set({ isLoading: false });
        }
      },

      updateQuantity: async (variantId, quantity) => {
        if (quantity <= 0) return get().removeItem(variantId);
        const { items, cartId, clearCart } = get();
        const item = items.find((i) => i.variantId === variantId);
        if (!item?.lineId || !cartId) return false;
        set({ isLoading: true });
        try {
          const result = await cartUpdateLineFn({
            data: { cartId, lineId: item.lineId, quantity },
          });
          if (result.ok) {
            set({
              items: items.map((i) => (i.variantId === variantId ? { ...i, quantity } : i)),
            });
            return true;
          }
          if (result.cartNotFound) clearCart();
          return false;
        } catch (error) {
          console.error('Failed to update quantity:', error);
          return false;
        } finally {
          set({ isLoading: false });
        }
      },

      removeItem: async (variantId) => {
        const { items, cartId, clearCart } = get();
        const item = items.find((i) => i.variantId === variantId);
        if (!item?.lineId || !cartId) return false;
        set({ isLoading: true });
        try {
          const result = await cartRemoveLineFn({
            data: { cartId, lineId: item.lineId },
          });
          if (result.ok) {
            const newItems = items.filter((i) => i.variantId !== variantId);
            if (newItems.length === 0) clearCart();
            else set({ items: newItems });
            return true;
          }
          if (result.cartNotFound) clearCart();
          return false;
        } catch (error) {
          console.error('Failed to remove item:', error);
          return false;
        } finally {
          set({ isLoading: false });
        }
      },

      clearCart: () => set({ items: [], cartId: null, checkoutUrl: null }),
      getCheckoutUrl: () => get().checkoutUrl,

      syncCart: async () => {
        const { cartId, isSyncing, clearCart } = get();
        if (!cartId || isSyncing) return;
        set({ isSyncing: true });
        try {
          const { exists } = await cartSyncFn({ data: { cartId } });
          if (!exists) clearCart();
        } catch (error) {
          console.error('Cart sync failed:', error);
        } finally {
          set({ isSyncing: false });
        }
      },
    }),
    {
      name: 'bessa-cart',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        items: state.items,
        cartId: state.cartId,
        checkoutUrl: state.checkoutUrl,
      }),
    },
  ),
);
