import { useEffect, useState } from 'react';
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
  getSizeProfileForCategory,
  getSizesForCategory,
  type ProductCategory,
  type SizeStock,
} from '@/lib/product-sizes';
import {
  COLOR_SWATCH_HEX,
  DEFAULT_COLOR,
  emptyVariantStock,
  flattenToSizeStock,
  getSuggestedColorsForCategory,
  normalizeVariantStock,
  resolveProductColors,
  resolveVariantStock,
  sumVariantStock,
  type VariantStock,
} from '@/lib/product-variants';
import { cn } from '@/lib/utils';

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
  productColors: z.array(z.string().min(1)).min(1, 'Selecione pelo menos uma cor'),
  variantStock: z.record(z.string(), z.record(z.string(), z.coerce.number().int().min(0))),
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
  product_colors?: string[] | null;
  variant_stock?: VariantStock | null;
}): Partial<ProductFormValues> {
  const category = productCategorySchema.safeParse(product.product_category);
  const productCategory: ProductCategory = category.success
    ? category.data
    : 'camiseta';
  const profile = getSizeProfileForCategory(productCategory);
  const productColors = resolveProductColors(product.product_colors);
  const variantStock = resolveVariantStock(
    profile,
    productColors,
    product.variant_stock ?? undefined,
    product.size_stock ?? undefined,
    product.stock_quantity,
  );

  return {
    title: product.title,
    slug: product.slug,
    description: product.description ?? '',
    priceReais: centsToPriceInput(product.price_cents),
    productCategory,
    productColors,
    variantStock,
    isActive: product.is_active,
    isFeatured: product.is_featured,
  };
}

export function formValuesToAdminPayload(values: ProductFormValues) {
  const profile = getSizeProfileForCategory(values.productCategory);
  const productColors = resolveProductColors(values.productColors);
  const variantStock = normalizeVariantStock(
    profile,
    productColors,
    values.variantStock,
  );
  const sizeStock = flattenToSizeStock(profile, variantStock);
  return {
    productCategory: values.productCategory,
    sizeProfile: profile,
    productColors,
    variantStock,
    sizeStock,
    stockQuantity: sumVariantStock(variantStock),
  };
}

export function ProductForm({
  defaultValues,
  submitLabel,
  onSubmit,
  disabled,
}: ProductFormProps) {
  const [customColor, setCustomColor] = useState('');

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      title: '',
      slug: '',
      description: '',
      priceReais: '',
      productCategory: 'camiseta',
      productColors: [DEFAULT_COLOR],
      variantStock: emptyVariantStock('apparel', [DEFAULT_COLOR]),
      isActive: true,
      isFeatured: false,
      ...defaultValues,
    },
  });

  const title = form.watch('title');
  const productCategory = form.watch('productCategory');
  const productColors = form.watch('productColors');
  const variantStock = form.watch('variantStock');
  const sizes = getSizesForCategory(productCategory);
  const suggestedColors = getSuggestedColorsForCategory(productCategory);

  useEffect(() => {
    const profile = getSizeProfileForCategory(productCategory);
    const colors = resolveProductColors(form.getValues('productColors'));
    const current = form.getValues('variantStock');
    form.setValue('variantStock', normalizeVariantStock(profile, colors, current));
  }, [productCategory, form]);

  const toggleColor = (color: string) => {
    const colors = form.getValues('productColors');
    const profile = getSizeProfileForCategory(form.getValues('productCategory'));
    if (colors.includes(color)) {
      if (colors.length <= 1) return;
      const nextColors = colors.filter((c) => c !== color);
      const vs = { ...form.getValues('variantStock') };
      delete vs[color];
      form.setValue('productColors', nextColors);
      form.setValue('variantStock', normalizeVariantStock(profile, nextColors, vs));
      return;
    }
    const nextColors = [...colors, color];
    const vs = form.getValues('variantStock');
    const empty = emptyVariantStock(profile, [color]);
    form.setValue('productColors', nextColors);
    form.setValue('variantStock', { ...vs, [color]: empty[color]! });
  };

  const addCustomColor = () => {
    const name = customColor.trim();
    if (!name) return;
    const colors = form.getValues('productColors');
    if (colors.includes(name)) {
      setCustomColor('');
      return;
    }
    toggleColor(name);
    setCustomColor('');
  };

  const copyFirstRowToAll = () => {
    const colors = form.getValues('productColors');
    const vs = form.getValues('variantStock');
    const first = colors[0];
    if (!first || !vs[first]) return;
    const template = { ...vs[first] };
    const next: VariantStock = {};
    for (const color of colors) {
      next[color] = { ...template };
    }
    form.setValue('variantStock', next);
  };

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
          <Label className="text-sm font-medium">Cores do produto</Label>
          <p className="text-xs text-muted-foreground">
            Toque para ativar ou desativar. Pelo menos uma cor é obrigatória.
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestedColors.map((color) => {
              const active = productColors.includes(color);
              const swatch = COLOR_SWATCH_HEX[color];
              return (
                <button
                  key={color}
                  type="button"
                  onClick={() => toggleColor(color)}
                  className={cn(
                    'inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition-colors',
                    active
                      ? 'border-gold bg-gold/10 text-gold'
                      : 'border-border hover:border-gold/50',
                  )}
                >
                  {swatch && (
                    <span
                      className="w-3 h-3 rounded-full border border-border shrink-0"
                      style={{ backgroundColor: swatch }}
                      aria-hidden
                    />
                  )}
                  {color}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 max-w-md">
            <Input
              value={customColor}
              onChange={(e) => setCustomColor(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustomColor();
                }
              }}
              className="border-gold/30"
              placeholder="Outra cor"
            />
            <Button
              type="button"
              variant="outline"
              className="border-gold/40 shrink-0"
              onClick={addCustomColor}
            >
              Adicionar
            </Button>
          </div>
          <FormField
            control={form.control}
            name="productColors"
            render={() => (
              <FormItem>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label className="text-sm font-medium">Estoque por cor e tamanho</Label>
            {productColors.length > 1 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-gold/40 text-xs"
                onClick={copyFirstRowToAll}
              >
                Copiar primeira linha para todas
              </Button>
            )}
          </div>
          <div className="overflow-x-auto rounded-lg border border-gold/20">
            <table className="w-full text-sm min-w-[320px]">
              <thead>
                <tr className="border-b border-gold/15 bg-muted/30">
                  <th className="text-left p-2 font-medium">Cor</th>
                  {sizes.map((size) => (
                    <th key={size} className="p-2 font-medium text-center w-16">
                      {size}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {productColors.map((color) => (
                  <tr key={color} className="border-b border-gold/10 last:border-0">
                    <td className="p-2 font-medium whitespace-nowrap">
                      <span className="inline-flex items-center gap-2">
                        {COLOR_SWATCH_HEX[color] && (
                          <span
                            className="w-3 h-3 rounded-full border border-border"
                            style={{ backgroundColor: COLOR_SWATCH_HEX[color] }}
                            aria-hidden
                          />
                        )}
                        {color}
                      </span>
                    </td>
                    {sizes.map((size) => (
                      <td key={`${color}-${size}`} className="p-1">
                        <FormField
                          control={form.control}
                          name={`variantStock.${color}.${size}`}
                          render={({ field }) => (
                            <FormItem className="space-y-0">
                              <FormControl>
                                <Input
                                  type="number"
                                  min={0}
                                  className="border-gold/30 h-8 text-center px-1"
                                  value={field.value ?? 0}
                                  onChange={(e) =>
                                    field.onChange(parseInt(e.target.value, 10) || 0)
                                  }
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Total: {sumVariantStock(variantStock)} unidade
            {sumVariantStock(variantStock) === 1 ? '' : 's'}
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
