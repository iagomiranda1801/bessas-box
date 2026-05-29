import { isSupabaseCart } from '@/lib/cart-config';
import { CartDrawer } from '@/components/CartDrawer';
import { SupabaseCartDrawer } from '@/components/SupabaseCartDrawer';

export function StoreCartDrawer() {
  return isSupabaseCart() ? <SupabaseCartDrawer /> : <CartDrawer />;
}
