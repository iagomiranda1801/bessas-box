import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/admin/pedidos')({
  component: AdminPedidosLayout,
});

function AdminPedidosLayout() {
  return <Outlet />;
}
