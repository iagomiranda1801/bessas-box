import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { adminDeleteImageFn, adminUploadImageFn } from '@/lib/admin.server';
import type { AdminProductRow } from '@/lib/catalog-types';

type ProductImagesPanelProps = {
  productId: string;
  accessToken: string;
  images: AdminProductRow['product_images'];
  onChange: () => void;
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64 ?? '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ProductImagesPanel({
  productId,
  accessToken,
  images,
  onChange,
}: ProductImagesPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const base64 = await fileToBase64(file);
        const result = await adminUploadImageFn({
          data: {
            accessToken,
            productId,
            fileName: file.name,
            contentType: file.type || 'image/jpeg',
            base64,
            isPrimary: images.length === 0,
          },
        });
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
      }
      toast.success('Imagem(ns) enviada(s).');
      onChange();
    } catch {
      toast.error('Falha ao enviar imagem.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleDelete = async (imageId: string) => {
    setDeletingId(imageId);
    try {
      const result = await adminDeleteImageFn({
        data: { accessToken, imageId },
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success('Imagem removida.');
      onChange();
    } catch {
      toast.error('Não foi possível remover a imagem.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="premium-card rounded-xl p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg">Fotos</h2>
          <p className="text-sm text-muted-foreground">JPEG, PNG ou WebP. A primeira vira capa.</p>
        </div>
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            className="border-gold/40"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? 'Enviando…' : 'Adicionar fotos'}
          </Button>
        </div>
      </div>

      {images.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma foto ainda.</p>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {images.map((img) => (
            <li key={img.id} className="relative group rounded-lg overflow-hidden border border-gold/20">
              <img
                src={img.public_url}
                alt={img.alt_text ?? ''}
                className="aspect-square object-cover w-full"
              />
              {img.is_primary && (
                <span className="absolute top-2 left-2 text-[10px] uppercase tracking-wider bg-gold text-onyx px-2 py-0.5 rounded">
                  Capa
                </span>
              )}
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                disabled={deletingId === img.id}
                onClick={() => handleDelete(img.id)}
              >
                {deletingId === img.id ? '…' : 'Remover'}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
