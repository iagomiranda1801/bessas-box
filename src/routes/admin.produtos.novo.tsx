import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { AdminLayout } from '@/components/admin/AdminLayout';
import {
  ProductForm,
  parsePriceToCents,
  type ProductFormValues,
} from '@/components/admin/ProductForm';
import { Button } from '@/components/ui/button';
import { adminCreateProductFn, adminUploadImageFn } from '@/lib/admin.server';
import { useAdminAuthStore } from '@/stores/adminAuthStore';

export const Route = createFileRoute('/admin/produtos/novo')({
  component: AdminNewProductPage,
  head: () => ({
    meta: [{ title: 'Admin — Novo produto' }, { name: 'robots', content: 'noindex' }],
  }),
});

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.includes(',') ? (result.split(',')[1] ?? '') : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function AdminNewProductPage() {
  const navigate = useNavigate();
  const accessToken = useAdminAuthStore((s) => s.accessToken);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (values: ProductFormValues) => {
    if (!accessToken) {
      toast.error('Sessão expirada. Entre novamente.');
      navigate({ to: '/admin/login' });
      return;
    }

    setSaving(true);
    try {
      const priceCents = parsePriceToCents(values.priceReais);
      const result = await adminCreateProductFn({
        data: {
          accessToken,
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

      for (let i = 0; i < pendingFiles.length; i++) {
        const file = pendingFiles[i];
        const base64 = await fileToBase64(file);
        const upload = await adminUploadImageFn({
          data: {
            accessToken,
            productId: result.id,
            fileName: file.name,
            contentType: file.type || 'image/jpeg',
            base64,
            isPrimary: i === 0,
          },
        });
        if (!upload.ok) {
          toast.error(`Produto criado, mas falha na foto: ${upload.message}`);
          navigate({ to: '/admin/produtos/$id', params: { id: result.id } });
          return;
        }
      }

      toast.success('Produto cadastrado.');
      navigate({ to: '/admin/produtos/$id', params: { id: result.id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar produto.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout
      title="Novo produto"
      actions={
        <Button asChild variant="outline" size="sm" className="border-gold/40">
          <Link to="/admin/produtos">Voltar</Link>
        </Button>
      }
    >
      <ProductForm submitLabel="Criar produto" onSubmit={handleSubmit} disabled={saving} />

      <div className="premium-card rounded-xl p-6 space-y-3">
        <h2 className="font-display text-lg">Fotos (opcional)</h2>
        <p className="text-sm text-muted-foreground">
          Selecione agora ou adicione depois na edição do produto.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => setPendingFiles(Array.from(e.target.files ?? []))}
        />
        <Button
          type="button"
          variant="outline"
          className="border-gold/40"
          onClick={() => fileInputRef.current?.click()}
        >
          Selecionar imagens
        </Button>
        {pendingFiles.length > 0 && (
          <p className="text-sm text-gold">{pendingFiles.length} arquivo(s) selecionado(s)</p>
        )}
      </div>
    </AdminLayout>
  );
}
