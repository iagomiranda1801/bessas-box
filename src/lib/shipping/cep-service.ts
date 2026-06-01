import type { CepInfo } from './types';

const UBERABA_CEP_RANGES = [
  { start: 38000000, end: 38999999 }
];

export async function getCepInfo(cep: string): Promise<CepInfo> {
  // Remove formatação do CEP
  const cleanCep = cep.replace(/\D/g, '');
  
  if (cleanCep.length !== 8) {
    return {
      cep,
      street: '',
      neighborhood: '',
      city: '',
      state: '',
      isUberaba: false,
      error: 'CEP deve ter 8 dígitos'
    };
  }

  const formattedCep = `${cleanCep.slice(0, 5)}-${cleanCep.slice(5)}`;

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
    
    if (!response.ok) {
      throw new Error('Erro na consulta do CEP');
    }

    const data = await response.json();

    if (data.erro) {
      return {
        cep: formattedCep,
        street: '',
        neighborhood: '',
        city: '',
        state: '',
        isUberaba: false,
        error: 'CEP não encontrado'
      };
    }

    // Verifica se é Uberaba pelo CEP numérico
    const numericCep = parseInt(cleanCep, 10);
    const isUberaba = UBERABA_CEP_RANGES.some(
      range => numericCep >= range.start && numericCep <= range.end
    ) || data.localidade?.toLowerCase().includes('uberaba');

    return {
      cep: formattedCep,
      street: data.logradouro || '',
      neighborhood: data.bairro || '',
      city: data.localidade || '',
      state: data.uf || '',
      isUberaba
    };
  } catch (error) {
    return {
      cep: formattedCep,
      street: '',
      neighborhood: '',
      city: '',
      state: '',
      isUberaba: false,
      error: error instanceof Error ? error.message : 'Erro ao consultar CEP'
    };
  }
}

export function formatCep(cep: string): string {
  const clean = cep.replace(/\D/g, '');
  if (clean.length === 8) {
    return `${clean.slice(0, 5)}-${clean.slice(5)}`;
  }
  return cep;
}

export function validateCep(cep: string): boolean {
  const clean = cep.replace(/\D/g, '');
  return clean.length === 8 && /^\d+$/.test(clean);
}