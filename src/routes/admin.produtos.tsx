import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/admin/produtos')({
  component: AdminProdutosLayout,
});

function AdminProdutosLayout() {
  return <Outlet />;
}
