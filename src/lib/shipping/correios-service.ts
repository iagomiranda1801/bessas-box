import type { ShippingOption, TrackingInfo, TrackingEvent } from './types';

// Simulação da API dos Correios (integração real requer Melhor Envio ou similar)
export async function calculateCorreiosShipping(params: {
  cepOrigin: string;
  cepDestination: string;
  weight: number; // kg
  services?: string[];
}): Promise<ShippingOption[]> {
  // Para desenvolvimento, usamos valores simulados
  // Em produção, integrar com Melhor Envio ou API dos Correios
  
  const { weight } = params;
  const baseWeight = 0.5; // kg
  const additionalWeight = Math.max(0, weight - baseWeight);
  
  const services = [
    {
      id: 'pac',
      method: 'correios' as const,
      serviceName: 'PAC',
      baseCost: 1500, // R$ 15,00
      costPerKg: 300, // R$ 3,00 por kg adicional
      estimatedDaysMin: 8,
      estimatedDaysMax: 12,
      isLocal: false,
      carrierService: '04014'
    },
    {
      id: 'sedex',
      method: 'correios' as const,
      serviceName: 'SEDEX',
      baseCost: 2500, // R$ 25,00
      costPerKg: 500, // R$ 5,00 por kg adicional
      estimatedDaysMin: 3,
      estimatedDaysMax: 5,
      isLocal: false,
      carrierService: '04510'
    }
  ];

  return services.map(service => ({
    id: service.id,
    method: service.method,
    serviceName: service.serviceName,
    costCents: service.baseCost + Math.round(additionalWeight * service.costPerKg),
    estimatedDaysMin: service.estimatedDaysMin,
    estimatedDaysMax: service.estimatedDaysMax,
    isLocal: service.isLocal,
    carrierService: service.carrierService
  }));
}

export async function trackCorreiosPackage(trackingCode: string): Promise<TrackingInfo> {
  // Simulação do rastreamento dos Correios
  // Em produção, integrar com API dos Correios ou web scraping
  
  try {
    // Simula consulta na API dos Correios
    const events: TrackingEvent[] = [
      {
        date: new Date().toISOString(),
        description: 'Objeto postado',
        location: 'Uberaba/MG'
      },
      {
        date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        description: 'Objeto em trânsito',
        location: 'Centro de Distribuição - São Paulo/SP'
      }
    ];

    return {
      status: 'in_transit',
      lastUpdate: events[0]?.date || new Date().toISOString(),
      events,
      estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
    };
  } catch (error) {
    throw new Error(`Erro ao rastrear código ${trackingCode}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}

// Função para gerar URL de rastreamento dos Correios
export function getCorreiosTrackingUrl(trackingCode: string): string {
  return `https://www2.correios.com.br/sistemas/rastreamento/ctrl/ctrlRastreamento.cfm?codigo=${trackingCode}`;
}

// Validação de código de rastreamento dos Correios
export function validateTrackingCode(code: string): boolean {
  // Formato: 2 letras + 9 números + 2 letras (ex: AA123456789BR)
  return /^[A-Z]{2}\d{9}[A-Z]{2}$/.test(code.toUpperCase());
}