import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useCustomerStore } from '@/stores/customerStore';

export function useRequireCustomer(returnTo: string) {
  const navigate = useNavigate();
  const accessToken = useCustomerStore((s) => s.accessToken);
  const isLoggedIn = useCustomerStore((s) => s.isLoggedIn());

  useEffect(() => {
    if (!isLoggedIn || !accessToken) {
      navigate({ to: '/conta/entrar', search: { returnTo } });
    }
  }, [accessToken, isLoggedIn, navigate, returnTo]);

  return { accessToken, isLoggedIn, ready: isLoggedIn && Boolean(accessToken) };
}
