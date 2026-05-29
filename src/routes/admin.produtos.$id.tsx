import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { ProductImagesPanel } from '@/components/admin/ProductImagesPanel';
import {
  ProductForm,
  centsToPriceInput,
  parsePriceToCents,
  type ProductFormValues,
} from '@/components/admin/ProductForm';
import { Button } from '@/components/ui/button';
import { adminGetProductFn, adminUpdateProductFn } from '@/lib/admin.server';
import type { AdminProductRow } from '@/lib/catalog-types';
import { useAdminAuthStore } from '@/stores/adminAuthStore';

export const Route = createFileRoute('/admin/produtos/$id')({
  component: AdminEditProductPage,
  head: () => ({
    meta: [{ title: 'Admin — Editar produto' }, { name: 'robots', content: 'noindex' }],
  }),
});

function AdminEditProductPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const [product, setProduct] = useState<AdminProductRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadProduct = useCallback(async () => {
    if (!accessToken) {
      navigate({ to: '/admin/login' });
      return;
    }
    setLoading(true);
    try {
      const result = await adminGetProductFn({ data: { accessToken, id } });
      if (!result.ok) {
        toast.error(result.message);
        navigate({ to: '/admin' });
        return;
      }
      setProduct(result.product);
    } catch {
      toast.error('Não foi possível carregar o produto.');
      navigate({ to: '/admin' });
    } finally {
      setLoading(false);
    }
  }, [accessToken, id, navigate]);

  useEffect(() => {
    void loadProduct();
  }, [loadProduct]);

  const handleSubmit = async (values: ProductFormValues) => {
    if (!accessToken || !product) return;
    setSaving(true);
    try {
      const priceCents = parsePriceToCents(values.priceReais);
      const result = await adminUpdateProductFn({
        data: {
          accessToken,
          id: product.id,
          title: values.title,
          slug: values.slug?.trim() || undefined,
          description: values.description,
          priceCents,
          stockQuantity: values.stockQuantity,
          isActive: values.isActive,
          isFeatured: values.isFeatured,
        },
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success('Produto atualizado.');
      await loadProduct();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Editar produto">
        <p className="text-muted-foreground">Carregando…</p>
      </AdminLayout>
    );
  }

  if (!product) return null;

  return (
    <AdminLayout
      title="Editar produto"
      actions={
        <Button asChild variant="outline" size="sm" className="border-gold/40">
          <Link to="/admin/produtos">Voltar</Link>
        </Button>
      }
    >
      <ProductForm
        submitLabel="Salvar alterações"
        disabled={saving}
        defaultValues={{
          title: product.title,
          slug: product.slug,
          description: product.description ?? '',
          priceReais: centsToPriceInput(product.price_cents),
          stockQuantity: product.stock_quantity,
          isActive: product.is_active,
          isFeatured: product.is_featured,
        }}
        onSubmit={handleSubmit}
      />

      {accessToken && (
        <ProductImagesPanel
          productId={product.id}
          accessToken={accessToken}
          images={product.product_images}
          onChange={loadProduct}
        />
      )}
    </AdminLayout>
  );
}
