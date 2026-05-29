import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ShopifyProduct } from '@/lib/shopify';
import {
  getMaxPurchasableQuantity,
  stockMessageForAdd,
  validateRequestedQuantity,
} from '@/lib/inventory';
import { variantStockFn } from '@/lib/inventory.server';
import {
  cartAddLineFn,
  cartCreateFn,
  cartRemoveLineFn,
  cartSyncFn,
  cartUpdateLineFn,
} from '@/lib/cart.server';

const CLIENT_STORE_DOMAIN =
  import.meta.env.VITE_SHOPIFY_STORE_DOMAIN ?? 'uvhyj5-ty.myshopify.com';

export interface CartItem {
  lineId: string | null;
  product: ShopifyProduct;
  variantId: string;
  variantTitle: string;
  price: { amount: string; currencyCode: string };
  quantity: number;
  quantityAvailable: number | null;
  availableForSale: boolean;
  selectedOptions: Array<{ name: string; value: string }>;
}

export type AddItemResult =
  | { ok: true }
  | { ok: false; message: string };

export type UpdateQuantityResult =
  | { ok: true }
  | { ok: false; message: string };

interface CartStore {
  items: CartItem[];
  cartId: string | null;
  checkoutUrl: string | null;
  storeDomain: string;
  pendingVariantId: string | null;
  isSyncing: boolean;
  addItem: (item: Omit<CartItem, 'lineId' | 'availableForSale'>) => Promise<AddItemResult>;
  updateQuantity: (variantId: string, quantity: number) => Promise<UpdateQuantityResult>;
  removeItem: (variantId: string) => Promise<boolean>;
  clearCart: () => void;
  syncCart: () => Promise<void>;
  getCheckoutUrl: () => string | null;
  getMaxForVariant: (variantId: string) => number;
}

const ADD_ITEM_ERROR = 'Não foi possível adicionar à sacola. Tente novamente.';

async function resolveVariantStock(
  variantId: string,
  fallback: { availableForSale: boolean; quantityAvailable: number | null },
) {
  try {
    const res = await variantStockFn({ data: { variantId } });
    if (res.ok && res.stock) return res.stock;
  } catch (error) {
    console.error('Failed to fetch variant stock:', error);
  }
  return fallback;
}

function stockFromCartItem(item: CartItem) {
  return {
    availableForSale: item.availableForSale,
    quantityAvailable: item.quantityAvailable,
  };
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      cartId: null,
      checkoutUrl: null,
      storeDomain: CLIENT_STORE_DOMAIN,
      pendingVariantId: null,
      isSyncing: false,

      getMaxForVariant: (variantId) => {
        const item = get().items.find((i) => i.variantId === variantId);
        if (!item) return 0;
        return getMaxPurchasableQuantity(stockFromCartItem(item));
      },

      addItem: async (item) => {
        const { items, cartId, clearCart } = get();
        const existingItem = items.find((i) => i.variantId === item.variantId);
        const variantNode = item.product.node.variants.edges.find(
          (e) => e.node.id === item.variantId,
        )?.node;
        const stock = await resolveVariantStock(item.variantId, {
          availableForSale: variantNode?.availableForSale ?? false,
          quantityAvailable:
            variantNode?.quantityAvailable ?? item.quantityAvailable ?? null,
        });
        const max = getMaxPurchasableQuantity(stock);
        const alreadyInCart = existingItem?.quantity ?? 0;
        const requestedTotal = alreadyInCart + item.quantity;

        if (max === 0) {
          return { ok: false, message: 'Este produto está esgotado.' };
        }

        const validation = validateRequestedQuantity(requestedTotal, max);
        if (!validation.ok) {
          return {
            ok: false,
            message:
              alreadyInCart > 0
                ? stockMessageForAdd(max, alreadyInCart)
                : validation.message,
          };
        }

        const itemWithStock: Omit<CartItem, 'lineId'> = {
          ...item,
          quantityAvailable: stock.quantityAvailable,
          availableForSale: stock.availableForSale,
        };

        set({ pendingVariantId: item.variantId });
        try {
          if (!cartId) {
            const result = await cartCreateFn({
              data: { variantId: item.variantId, quantity: item.quantity },
            });
            if (result.ok) {
              set({
                cartId: result.cartId,
                checkoutUrl: result.checkoutUrl,
                items: [{ ...itemWithStock, lineId: result.lineId }],
              });
              return { ok: true };
            }
            if (result.cartNotFound) clearCart();
            return { ok: false, message: result.message || ADD_ITEM_ERROR };
          }

          if (existingItem) {
            const newQuantity = requestedTotal;
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
                  i.variantId === item.variantId
                    ? {
                        ...i,
                        quantity: newQuantity,
                        quantityAvailable: stock.quantityAvailable,
                        availableForSale: stock.availableForSale,
                      }
                    : i,
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
              items: [...items, { ...itemWithStock, lineId: result.lineId }],
            });
            return { ok: true };
          }
          if (result.cartNotFound) clearCart();
          return { ok: false, message: result.message || ADD_ITEM_ERROR };
        } catch (error) {
          console.error('Failed to add item:', error);
          return { ok: false, message: ADD_ITEM_ERROR };
        } finally {
          set({ pendingVariantId: null });
        }
      },

      updateQuantity: async (variantId, quantity) => {
        if (quantity <= 0) {
          const removed = await get().removeItem(variantId);
          return removed ? { ok: true } : { ok: false, message: ADD_ITEM_ERROR };
        }

        const { items, cartId, clearCart } = get();
        const item = items.find((i) => i.variantId === variantId);
        if (!item?.lineId || !cartId) {
          return { ok: false, message: ADD_ITEM_ERROR };
        }

        const stock = await resolveVariantStock(variantId, stockFromCartItem(item));
        const max = getMaxPurchasableQuantity(stock);
        const validation = validateRequestedQuantity(quantity, max);
        if (!validation.ok) {
          return { ok: false, message: validation.message };
        }

        set({ pendingVariantId: variantId });
        try {
          const result = await cartUpdateLineFn({
            data: { cartId, lineId: item.lineId, quantity },
          });
          if (result.ok) {
            set({
              items: items.map((i) =>
                i.variantId === variantId
                  ? {
                      ...i,
                      quantity,
                      quantityAvailable: stock.quantityAvailable,
                      availableForSale: stock.availableForSale,
                    }
                  : i,
              ),
            });
            return { ok: true };
          }
          if (result.cartNotFound) clearCart();
          return { ok: false, message: result.message || ADD_ITEM_ERROR };
        } catch (error) {
          console.error('Failed to update quantity:', error);
          return { ok: false, message: ADD_ITEM_ERROR };
        } finally {
          set({ pendingVariantId: null });
        }
      },

      removeItem: async (variantId) => {
        const { items, cartId, clearCart } = get();
        const item = items.find((i) => i.variantId === variantId);
        if (!item?.lineId || !cartId) return false;
        set({ pendingVariantId: variantId });
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
          set({ pendingVariantId: null });
        }
      },

      clearCart: () =>
        set({
          items: [],
          cartId: null,
          checkoutUrl: null,
          pendingVariantId: null,
          storeDomain: CLIENT_STORE_DOMAIN,
        }),
      getCheckoutUrl: () => get().checkoutUrl,

      syncCart: async () => {
        const { cartId, isSyncing, clearCart, items } = get();
        if (!cartId || isSyncing) return;
        set({ isSyncing: true });
        try {
          const { exists } = await cartSyncFn({ data: { cartId } });
          if (!exists) {
            clearCart();
            return;
          }

          const nextItems = [...items];
          let changed = false;
          for (let i = 0; i < nextItems.length; i++) {
            const cartItem = nextItems[i];
            const stock = await resolveVariantStock(cartItem.variantId, stockFromCartItem(cartItem));
            const max = getMaxPurchasableQuantity(stock);
            if (max === 0) {
              clearCart();
              return;
            }
            if (cartItem.quantity > max) {
              nextItems[i] = {
                ...cartItem,
                quantity: max,
                quantityAvailable: stock.quantityAvailable,
                availableForSale: stock.availableForSale,
              };
              changed = true;
              if (cartItem.lineId) {
                await cartUpdateLineFn({
                  data: { cartId, lineId: cartItem.lineId, quantity: max },
                });
              }
            } else if (
              stock.quantityAvailable !== cartItem.quantityAvailable ||
              stock.availableForSale !== cartItem.availableForSale
            ) {
              nextItems[i] = {
                ...cartItem,
                quantityAvailable: stock.quantityAvailable,
                availableForSale: stock.availableForSale,
              };
              changed = true;
            }
          }
          if (changed) set({ items: nextItems });
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
        storeDomain: state.storeDomain,
      }),
      merge: (persisted, current) => {
        const persistedState = persisted as Partial<CartStore> | undefined;
        if (
          persistedState?.storeDomain &&
          persistedState.storeDomain !== CLIENT_STORE_DOMAIN
        ) {
          return {
            ...current,
            items: [],
            cartId: null,
            checkoutUrl: null,
            storeDomain: CLIENT_STORE_DOMAIN,
          };
        }
        const items = (persistedState?.items ?? []).map((item) => ({
          ...item,
          availableForSale: item.availableForSale ?? true,
        }));
        return {
          ...current,
          ...persistedState,
          items,
          storeDomain: persistedState?.storeDomain ?? CLIENT_STORE_DOMAIN,
        };
      },
    },
  ),
);
