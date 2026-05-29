import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { useAdminAuthStore, waitForAdminAuthHydration } from '@/stores/adminAuthStore';

export const Route = createFileRoute('/admin')({
  beforeLoad: async ({ location }) => {
    if (location.pathname === '/admin/login') return;
    if (typeof window === 'undefined') return;

    await waitForAdminAuthHydration();

    const { accessToken, verifySession } = useAdminAuthStore.getState();
    if (!accessToken) throw redirect({ to: '/admin/login' });

    const ok = await verifySession();
    if (!ok) throw redirect({ to: '/admin/login' });
  },
  component: AdminRouteLayout,
});

function AdminRouteLayout() {
  return <Outlet />;
}
