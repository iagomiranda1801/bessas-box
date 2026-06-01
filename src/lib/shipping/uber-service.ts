import type { ShippingOption } from './types';

// Simulação do Uber Connect para entregas locais em Uberaba
export async function calculateUberShipping(params: {
  originAddress: string;
  destinationAddress: string;
  weight?: number;
}): Promise<ShippingOption> {
  // Para desenvolvimento, usamos valores simulados baseados em distância aproximada
  // Em produção, integrar com Uber Direct API quando disponível
  
  const { weight = 0.5 } = params;
  
  // Simula cálculo de distância (em uma implementação real, usar Google Maps API ou similar)
  const baseDistance = 5; // km simulado
  const baseCost = 800; // R$ 8,00
  const costPerKm = 100; // R$ 1,00 por km adicional
  const weightSurcharge = weight > 1 ? Math.round((weight - 1) * 200) : 0; // R$ 2,00 por kg adicional
  
  const totalCost = baseCost + (baseDistance * costPerKm) + weightSurcharge;

  return {
    id: 'uber_connect',
    method: 'uber_local',
    serviceName: 'Uber Connect',
    costCents: totalCost,
    estimatedDaysMin: 1,
    estimatedDaysMax: 1,
    isLocal: true,
    carrierService: 'uber_connect'
  };
}

// Simulação de rastreamento Uber (quando disponível)
export async function trackUberDelivery(deliveryId: string): Promise<{
  status: string;
  driverName?: string;
  estimatedArrival?: string;
  currentLocation?: { lat: number; lng: number };
}> {
  // Simulação - em produção seria integração real com Uber API
  return {
    status: 'on_the_way',
    driverName: 'João Silva',
    estimatedArrival: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutos
    currentLocation: { lat: -19.7479, lng: -47.9419 } // Centro de Uberaba
  };
}

// Função para verificar se endereço está na área de cobertura do Uber
export function isUberCoverageArea(cep: string): boolean {
  const cleanCep = cep.replace(/\D/g, '');
  const numericCep = parseInt(cleanCep, 10);
  
  // CEPs de Uberaba: 38000-000 a 38999-999
  return numericCep >= 38000000 && numericCep <= 38999999;
}