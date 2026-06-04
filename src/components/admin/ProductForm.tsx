import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { slugifyTitle } from '@/lib/catalog-config';
import {
  PRODUCT_CATEGORIES,
  emptySizeStock,
  getSizeProfileForCategory,
  getSizesForCategory,
  normalizeSizeStock,
  sumSizeStock,
  type ProductCategory,
  type SizeStock,
} from '@/lib/product-sizes';

const productCategorySchema = z.enum([
  'camiseta',
  'polo',
  'shorts',
  'tenis',
  'calca_jeans',
  'bone',
]);

const productFormSchema = z.object({
  title: z.string().min(1, 'Título obrigatório'),
  slug: z.string().max(80).optional(),
  description: z.string().max(5000).optional(),
  priceReais: z.string().min(1, 'Preço obrigatório'),
  productCategory: productCategorySchema,
  sizeStock: z.record(z.string(), z.coerce.number().int().min(0)),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;

type ProductFormProps = {
  defaultValues?: Partial<ProductFormValues>;
  submitLabel: string;
  onSubmit: (values: ProductFormValues) => Promise<void>;
  disabled?: boolean;
};

export function parsePriceToCents(priceReais: string): number {
  const normalized = priceReais.replace(',', '.').trim();
  const value = parseFloat(normalized);
  if (Number.isNaN(value) || value <= 0) throw new Error('Preço inválido');
  return Math.round(value * 100);
}

export function centsToPriceInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

export function productRowToFormDefaults(product: {
  title: string;
  slug: string;
  description: string | null;
  price_cents: number;
  stock_quantity: number;
  is_active: boolean;
  is_featured: boolean;
  product_category?: string | null;
  size_profile?: string | null;
  size_stock?: SizeStock | null;
}): Partial<ProductFormValues> {
  const category = productCategorySchema.safeParse(product.product_category);
  const productCategory: ProductCategory = category.success
    ? category.data
    : 'camiseta';
  const profile = getSizeProfileForCategory(productCategory);
  const sizeStock =
    product.size_stock && Object.keys(product.size_stock).length > 0
      ? normalizeSizeStock(profile, product.size_stock)
      : emptySizeStock(profile);

  return {
    title: product.title,
    slug: product.slug,
    description: product.description ?? '',
    priceReais: centsToPriceInput(product.price_cents),
    productCategory,
    sizeStock,
    isActive: product.is_active,
    isFeatured: product.is_featured,
  };
}

export function formValuesToAdminPayload(values: ProductFormValues) {
  const profile = getSizeProfileForCategory(values.productCategory);
  const sizeStock = normalizeSizeStock(profile, values.sizeStock);
  return {
    productCategory: values.productCategory,
    sizeProfile: profile,
    sizeStock,
    stockQuantity: sumSizeStock(sizeStock),
  };
}

export function ProductForm({
  defaultValues,
  submitLabel,
  onSubmit,
  disabled,
}: ProductFormProps) {
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      title: '',
      slug: '',
      description: '',
      priceReais: '',
      productCategory: 'camiseta',
      sizeStock: emptySizeStock('apparel'),
      isActive: true,
      isFeatured: false,
      ...defaultValues,
    },
  });

  const title = form.watch('title');
  const productCategory = form.watch('productCategory');
  const sizes = getSizesForCategory(productCategory);

  useEffect(() => {
    const current = form.getValues('sizeStock');
    const profile = getSizeProfileForCategory(productCategory);
    const next = emptySizeStock(profile);
    for (const size of getSizesForCategory(productCategory)) {
      next[size] = current[size] ?? 0;
    }
    form.setValue('sizeStock', next);
  }, [productCategory, form]);

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(async (values) => {
          await onSubmit(values);
        })}
        className="premium-card rounded-xl p-6 space-y-5"
      >
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Título</FormLabel>
              <FormControl>
                <Input {...field} className="border-gold/30" placeholder="Calça Jeans Lisa" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="productCategory"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Categoria</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="border-gold/30">
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {PRODUCT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Slug (URL)</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  className="border-gold/30 font-mono text-sm"
                  placeholder={title ? slugifyTitle(title) : 'calca-jeans-lisa'}
                />
              </FormControl>
              <p className="text-xs text-muted-foreground">
                /product/{field.value || (title ? slugifyTitle(title) : 'slug')}
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição</FormLabel>
              <FormControl>
                <Textarea {...field} rows={4} className="border-gold/30 resize-y" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="priceReais"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Preço (R$)</FormLabel>
              <FormControl>
                <Input {...field} className="border-gold/30" placeholder="199,90" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-3">
          <Label className="text-sm font-medium">Estoque por tamanho</Label>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {sizes.map((size) => (
              <FormField
                key={size}
                control={form.control}
                name={`sizeStock.${size}` as `sizeStock.${string}`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-muted-foreground">{size}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        className="border-gold/30"
                        value={field.value ?? 0}
                        onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Total:{' '}
            {sumSizeStock(form.watch('sizeStock'))} unidade
            {sumSizeStock(form.watch('sizeStock')) === 1 ? '' : 's'}
          </p>
        </div>

        <div className="flex flex-wrap gap-6">
          <FormField
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <FormItem className="flex items-center gap-2 space-y-0">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="font-normal cursor-pointer">Ativo na loja</FormLabel>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="isFeatured"
            render={({ field }) => (
              <FormItem className="flex items-center gap-2 space-y-0">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="font-normal cursor-pointer">Destaque</FormLabel>
              </FormItem>
            )}
          />
        </div>

        <Button
          type="submit"
          disabled={disabled || form.formState.isSubmitting}
          className="bg-gold text-onyx hover:bg-gold-soft"
        >
          {form.formState.isSubmitting ? 'Salvando…' : submitLabel}
        </Button>
      </form>
    </Form>
  );
}
