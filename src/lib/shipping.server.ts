import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { getCepInfo } from '@/lib/shipping/cep-service';
import { calculateCorreiosShipping } from '@/lib/shipping/correios-service';
import { calculateUberShipping, isUberCoverageArea } from '@/lib/shipping/uber-service';
import type { ShippingOption, ShippingRateRow } from '@/lib/shipping/types';

const calculateShippingSchema = z.object({
  cep: z.string().regex(/^\d{5}-?\d{3}$/, 'CEP inválido'),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive(),
  })).min(1, 'Pelo menos um item é obrigatório'),
});

const updateShipmentSchema = z.object({
  accessToken: z.string().min(1),
  orderId: z.string().uuid(),
  trackingCode: z.string().min(1),
  carrierService: z.string().min(1),
  estimatedDeliveryDate: z.string().optional(),
});

export const calculateShippingFn = createServerFn({ method: 'POST' })
  .inputValidator(calculateShippingSchema)
  .handler(async ({ data }) => {
    try {
      const client = getSupabaseServiceClient();
      
      // 1. Validar CEP e obter informações
      const cepInfo = await getCepInfo(data.cep);
      if (cepInfo.error) {
        return { ok: false as const, message: cepInfo.error };
      }

      // 2. Buscar produtos para calcular peso total
      const productIds = data.items.map(item => item.productId);
      const { data: products, error: productsError } = await client
        .from('products')
        .select('id, weight_kg')
        .in('id', productIds);

      if (productsError || !products) {
        return { ok: false as const, message: 'Erro ao buscar produtos' };
      }

      // 3. Calcular peso total
      let totalWeight = 0;
      for (const item of data.items) {
        const product = products.find(p => p.id === item.productId);
        const weight = product?.weight_kg || 0.5; // peso padrão 0.5kg
        totalWeight += weight * item.quantity;
      }

      // 4. Buscar tarifas base do banco
      const { data: rates, error: ratesError } = await client
        .from('shipping_rates')
        .select('*')
        .eq('is_active', true);

      if (ratesError) {
        return { ok: false as const, message: 'Erro ao buscar tarifas' };
      }

      const shippingRates = rates as ShippingRateRow[];
      const options: ShippingOption[] = [];

      // 5. Calcular opções de frete
      const storeCep = process.env.STORE_CEP || '38400-100';

      // Opções dos Correios (sempre disponível)
      try {
        const correiosOptions = await calculateCorreiosShipping({
          cepOrigin: storeCep,
          cepDestination: data.cep,
          weight: totalWeight,
        });
        options.push(...correiosOptions);
      } catch (error) {
        console.error('Erro ao calcular frete Correios:', error);
        
        // Fallback: usar tarifas fixas do banco
        const correiosRates = shippingRates.filter(rate => rate.method === 'correios');
        for (const rate of correiosRates) {
          const additionalWeight = Math.max(0, totalWeight - 1); // peso base 1kg
          const additionalCost = Math.round(additionalWeight * rate.weight_factor * 100);
          
          options.push({
            id: rate.id,
            method: rate.method,
            serviceName: rate.service_name,
            costCents: rate.base_cost_cents + additionalCost,
            estimatedDaysMin: rate.estimated_days_min,
            estimatedDaysMax: rate.estimated_days_max,
            isLocal: rate.is_local,
          });
        }
      }

      // Uber Connect (apenas para Uberaba)
      if (cepInfo.isUberaba && isUberCoverageArea(data.cep)) {
        try {
          const uberOption = await calculateUberShipping({
            originAddress: process.env.STORE_ADDRESS || 'Centro, Uberaba, MG',
            destinationAddress: `${cepInfo.street}, ${cepInfo.neighborhood}, ${cepInfo.city}, ${cepInfo.state}`,
            weight: totalWeight,
          });
          options.push(uberOption);
        } catch (error) {
          console.error('Erro ao calcular frete Uber:', error);
          
          // Fallback: usar tarifa fixa do banco
          const uberRate = shippingRates.find(rate => rate.method === 'uber_local');
          if (uberRate) {
            const additionalWeight = Math.max(0, totalWeight - 1);
            const additionalCost = Math.round(additionalWeight * uberRate.weight_factor * 100);
            
            options.push({
              id: uberRate.id,
              method: uberRate.method,
              serviceName: uberRate.service_name,
              costCents: uberRate.base_cost_cents + additionalCost,
              estimatedDaysMin: uberRate.estimated_days_min,
              estimatedDaysMax: uberRate.estimated_days_max,
              isLocal: uberRate.is_local,
            });
          }
        }
      }

      return {
        ok: true as const,
        cepInfo,
        options: options.sort((a, b) => a.costCents - b.costCents), // ordenar por preço
        totalWeight,
      };
    } catch (error) {
      console.error('Erro no cálculo de frete:', error);
      return {
        ok: false as const,
        message: 'Erro interno no cálculo de frete. Tente novamente.',
      };
    }
  });

export const updateShipmentFn = createServerFn({ method: 'POST' })
  .inputValidator(updateShipmentSchema)
  .handler(async ({ data }) => {
    try {
      // Verificar permissão admin
      const { requireAdmin } = await import('@/lib/admin-auth.server');
      await requireAdmin(data.accessToken);
      
      const client = getSupabaseServiceClient();
      
      // Buscar ou criar shipment
      const { data: existingShipment } = await client
        .from('shipments')
        .select('id')
        .eq('order_id', data.orderId)
        .maybeSingle();

      const shipmentData = {
        tracking_code: data.trackingCode,
        carrier_service: data.carrierService,
        status: 'shipped' as const,
        updated_at: new Date().toISOString(),
        ...(data.estimatedDeliveryDate && {
          estimated_delivery_date: data.estimatedDeliveryDate.split('T')[0]
        })
      };

      if (existingShipment) {
        // Atualizar shipment existente
        const { error: updateError } = await client
          .from('shipments')
          .update(shipmentData)
          .eq('id', existingShipment.id);

        if (updateError) {
          return { ok: false as const, message: updateError.message };
        }
      } else {
        // Buscar dados do pedido para criar novo shipment
        const { data: order, error: orderError } = await client
          .from('orders')
          .select('shipping_address, shipping_cost_cents')
          .eq('id', data.orderId)
          .single();

        if (orderError || !order) {
          return { ok: false as const, message: 'Pedido não encontrado' };
        }

        // Criar novo shipment
        const { error: insertError } = await client
          .from('shipments')
          .insert({
            order_id: data.orderId,
            shipping_method: data.carrierService.includes('uber') ? 'uber_local' : 'correios',
            delivery_address: order.shipping_address || {},
            shipping_cost_cents: order.shipping_cost_cents || 0,
            ...shipmentData,
          });

        if (insertError) {
          return { ok: false as const, message: insertError.message };
        }
      }

      // Atualizar status do pedido para 'shipped'
      await client
        .from('orders')
        .update({ 
          status: 'shipped',
          updated_at: new Date().toISOString() 
        })
        .eq('id', data.orderId);

      // Adicionar ao histórico
      await client
        .from('order_status_history')
        .insert({
          order_id: data.orderId,
          status: 'shipped',
          changed_by: 'admin',
        });

      return { ok: true as const };
    } catch (error) {
      console.error('Erro ao atualizar envio:', error);
      return {
        ok: false as const,
        message: error instanceof Error ? error.message : 'Erro interno',
      };
    }
  });