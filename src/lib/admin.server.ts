import { createServerFn } from '@tanstack/react-start';

import { z } from 'zod';

import { accessTokenSchema, requireAdmin } from '@/lib/admin-auth.server';

import { slugifyTitle } from '@/lib/catalog-config';

import {

  fetchAdminProductById,

  fetchAllAdminProducts,

  getPublicImageUrl,

} from '@/lib/supabase-catalog';

import { getSupabaseServiceClient } from '@/lib/supabase-server';



const productInputSchema = z.object({

  accessToken: z.string().min(1),

  title: z.string().min(1).max(200),

  description: z.string().max(5000).optional(),

  priceCents: z.number().int().positive(),

  stockQuantity: z.number().int().min(0),

  isActive: z.boolean(),

  isFeatured: z.boolean(),

  slug: z.string().max(80).optional(),

});



export const adminListProductsFn = createServerFn({ method: 'POST' })

  .inputValidator(accessTokenSchema)

  .handler(async ({ data }) => {

    await requireAdmin(data.accessToken);

    const products = await fetchAllAdminProducts();

    return { ok: true as const, products };

  });



export const adminGetProductFn = createServerFn({ method: 'POST' })

  .inputValidator(

    z.object({

      accessToken: z.string().min(1),

      id: z.string().uuid(),

    }),

  )

  .handler(async ({ data }) => {

    await requireAdmin(data.accessToken);

    const product = await fetchAdminProductById(data.id);

    if (!product) return { ok: false as const, message: 'Produto não encontrado.' };

    return { ok: true as const, product };

  });



export const adminCreateProductFn = createServerFn({ method: 'POST' })

  .inputValidator(productInputSchema)

  .handler(async ({ data }) => {

    await requireAdmin(data.accessToken);

    const slug = data.slug?.trim() || slugifyTitle(data.title);

    if (!slug) return { ok: false as const, message: 'Slug inválido.' };



    const client = getSupabaseServiceClient();

    const { data: row, error } = await client

      .from('products')

      .insert({

        title: data.title,

        slug,

        description: data.description ?? '',

        price_cents: data.priceCents,

        stock_quantity: data.stockQuantity,

        is_active: data.isActive,

        is_featured: data.isFeatured,

      })

      .select('id')

      .single();



    if (error) {

      if (error.code === '23505') {

        return { ok: false as const, message: 'Já existe um produto com este slug.' };

      }

      return { ok: false as const, message: error.message };

    }



    return { ok: true as const, id: row.id as string };

  });



export const adminUpdateProductFn = createServerFn({ method: 'POST' })

  .inputValidator(

    productInputSchema.extend({

      id: z.string().uuid(),

    }),

  )

  .handler(async ({ data }) => {

    await requireAdmin(data.accessToken);

    const slug = data.slug?.trim() || slugifyTitle(data.title);



    const client = getSupabaseServiceClient();

    const { error } = await client

      .from('products')

      .update({

        title: data.title,

        slug,

        description: data.description ?? '',

        price_cents: data.priceCents,

        stock_quantity: data.stockQuantity,

        is_active: data.isActive,

        is_featured: data.isFeatured,

        updated_at: new Date().toISOString(),

      })

      .eq('id', data.id);



    if (error) {

      if (error.code === '23505') {

        return { ok: false as const, message: 'Slug já em uso por outro produto.' };

      }

      return { ok: false as const, message: error.message };

    }



    return { ok: true as const };

  });



export const adminToggleProductFn = createServerFn({ method: 'POST' })

  .inputValidator(

    accessTokenSchema.extend({

      id: z.string().uuid(),

      field: z.enum(['is_active', 'is_featured']),

      value: z.boolean(),

    }),

  )

  .handler(async ({ data }) => {

    await requireAdmin(data.accessToken);

    const client = getSupabaseServiceClient();

    const { error } = await client

      .from('products')

      .update({ [data.field]: data.value, updated_at: new Date().toISOString() })

      .eq('id', data.id);



    if (error) return { ok: false as const, message: error.message };

    return { ok: true as const };

  });



export const adminAdjustStockFn = createServerFn({ method: 'POST' })

  .inputValidator(

    accessTokenSchema.extend({

      id: z.string().uuid(),

      stockQuantity: z.number().int().min(0),

    }),

  )

  .handler(async ({ data }) => {

    await requireAdmin(data.accessToken);

    const client = getSupabaseServiceClient();

    const { error } = await client

      .from('products')

      .update({ stock_quantity: data.stockQuantity, updated_at: new Date().toISOString() })

      .eq('id', data.id);



    if (error) return { ok: false as const, message: error.message };

    return { ok: true as const };

  });



const uploadSchema = z.object({

  accessToken: z.string().min(1),

  productId: z.string().uuid(),

  fileName: z.string().min(1).max(200),

  contentType: z.string().min(1),

  base64: z.string().min(1),

  altText: z.string().max(200).optional(),

  isPrimary: z.boolean().optional(),

});



export const adminUploadImageFn = createServerFn({ method: 'POST' })

  .inputValidator(uploadSchema)

  .handler(async ({ data }) => {

    await requireAdmin(data.accessToken);



    const product = await fetchAdminProductById(data.productId);

    if (!product) return { ok: false as const, message: 'Produto não encontrado.' };



    const safeName = data.fileName.replace(/[^a-zA-Z0-9._-]/g, '-');

    const storagePath = `${product.slug}/${Date.now()}-${safeName}`;

    const buffer = Buffer.from(data.base64, 'base64');



    const client = getSupabaseServiceClient();

    const { error: uploadError } = await client.storage

      .from('product-images')

      .upload(storagePath, buffer, {

        contentType: data.contentType,

        upsert: false,

      });



    if (uploadError) {

      return { ok: false as const, message: uploadError.message };

    }



    const publicUrl = getPublicImageUrl(storagePath);

    const sortOrder = product.product_images?.length ?? 0;

    const isPrimary = data.isPrimary ?? sortOrder === 0;



    if (isPrimary) {

      await client

        .from('product_images')

        .update({ is_primary: false })

        .eq('product_id', data.productId);

    }



    const { error: insertError } = await client.from('product_images').insert({

      product_id: data.productId,

      storage_path: storagePath,

      public_url: publicUrl,

      alt_text: data.altText ?? product.title,

      sort_order: sortOrder,

      is_primary: isPrimary,

    });



    if (insertError) {

      return { ok: false as const, message: insertError.message };

    }



    return { ok: true as const, publicUrl };

  });



export const adminDeleteImageFn = createServerFn({ method: 'POST' })

  .inputValidator(

    z.object({

      accessToken: z.string().min(1),

      imageId: z.string().uuid(),

    }),

  )

  .handler(async ({ data }) => {

    await requireAdmin(data.accessToken);

    const client = getSupabaseServiceClient();



    const { data: image, error: fetchError } = await client

      .from('product_images')

      .select('id, storage_path')

      .eq('id', data.imageId)

      .maybeSingle();



    if (fetchError || !image) {

      return { ok: false as const, message: 'Imagem não encontrada.' };

    }



    await client.storage.from('product-images').remove([image.storage_path]);

    const { error } = await client.from('product_images').delete().eq('id', data.imageId);



    if (error) return { ok: false as const, message: error.message };

    return { ok: true as const };

  });



export { adminVerifyFn, adminCheckEmailAllowedFn } from '@/lib/admin-auth.server';


