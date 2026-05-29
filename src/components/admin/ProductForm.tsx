import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { slugifyTitle } from '@/lib/catalog-config';

const productFormSchema = z.object({
  title: z.string().min(1, 'Título obrigatório'),
  slug: z.string().max(80).optional(),
  description: z.string().max(5000).optional(),
  priceReais: z.string().min(1, 'Preço obrigatório'),
  stockQuantity: z.coerce.number().int().min(0),
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
      stockQuantity: 0,
      isActive: true,
      isFeatured: false,
      ...defaultValues,
    },
  });

  const title = form.watch('title');

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="premium-card rounded-xl p-6 space-y-5">
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

        <div className="grid sm:grid-cols-2 gap-4">
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

          <FormField
            control={form.control}
            name="stockQuantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estoque</FormLabel>
                <FormControl>
                  <Input {...field} type="number" min={0} className="border-gold/30" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
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
