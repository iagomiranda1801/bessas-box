export type AsaasCustomer = {
  id: string;
  name: string;
  email: string;
  cpfCnpj?: string;
};

export type AsaasPayment = {
  id: string;
  status: string;
  value: number;
  dueDate: string;
  invoiceUrl?: string;
  externalReference?: string;
};

export type AsaasPixQrCode = {
  encodedImage: string;
  payload: string;
  expirationDate?: string;
};

function getAsaasBaseUrl(): string {
  const sandbox = process.env.ASAAS_SANDBOX?.trim().toLowerCase();
  const isSandbox = sandbox !== 'false' && sandbox !== '0';
  return isSandbox ? 'https://api-sandbox.asaas.com/v3' : 'https://api.asaas.com/v3';
}

function getApiKey(): string | null {
  const key = process.env.ASAAS_API_KEY?.trim();
  return key || null;
}

async function asaasRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('ASAAS_API_KEY não configurada');

  const url = `${getAsaasBaseUrl()}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      access_token: apiKey,
      ...(options.headers as Record<string, string>),
    },
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errors = Array.isArray(body.errors)
      ? body.errors.map((e: { description?: string }) => e.description).join(', ')
      : body.message || response.statusText;
    throw new Error(errors || `Erro Asaas (${response.status})`);
  }

  return body as T;
}

export function isAsaasConfigured(): boolean {
  return Boolean(getApiKey());
}

export function getAsaasDashboardUrl(paymentId: string): string {
  const sandbox = process.env.ASAAS_SANDBOX?.trim().toLowerCase();
  const isSandbox = sandbox !== 'false' && sandbox !== '0';
  return isSandbox
    ? `https://sandbox.asaas.com/i/${paymentId}`
    : `https://www.asaas.com/i/${paymentId}`;
}

export async function findCustomerByEmailOrCpf(
  email: string,
  cpfCnpj: string,
): Promise<AsaasCustomer | null> {
  const cleanCpf = cpfCnpj.replace(/\D/g, '');
  const byCpf = await asaasRequest<{ data: AsaasCustomer[] }>(
    `/customers?cpfCnpj=${cleanCpf}&limit=1`,
  );
  if (byCpf.data?.[0]) return byCpf.data[0];

  const byEmail = await asaasRequest<{ data: AsaasCustomer[] }>(
    `/customers?email=${encodeURIComponent(email)}&limit=1`,
  );
  return byEmail.data?.[0] ?? null;
}

export async function createCustomer(params: {
  name: string;
  email: string;
  cpfCnpj: string;
  phone?: string;
}): Promise<AsaasCustomer> {
  const cleanCpf = params.cpfCnpj.replace(/\D/g, '');
  const cleanPhone = params.phone?.replace(/\D/g, '');

  return asaasRequest<AsaasCustomer>('/customers', {
    method: 'POST',
    body: JSON.stringify({
      name: params.name,
      email: params.email,
      cpfCnpj: cleanCpf,
      ...(cleanPhone && { mobilePhone: cleanPhone }),
    }),
  });
}

export async function findOrCreateCustomer(params: {
  name: string;
  email: string;
  cpfCnpj: string;
  phone?: string;
}): Promise<AsaasCustomer> {
  const existing = await findCustomerByEmailOrCpf(params.email, params.cpfCnpj);
  if (existing) return existing;
  return createCustomer(params);
}

export type AsaasBillingType = 'UNDEFINED' | 'PIX' | 'BOLETO' | 'CREDIT_CARD';

export async function createPayment(params: {
  customerId: string;
  value: number;
  externalReference: string;
  dueDate?: string;
  billingType?: AsaasBillingType;
}): Promise<AsaasPayment> {
  const dueDate =
    params.dueDate ??
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  return asaasRequest<AsaasPayment>('/payments', {
    method: 'POST',
    body: JSON.stringify({
      customer: params.customerId,
      billingType: params.billingType ?? 'UNDEFINED',
      value: params.value,
      dueDate,
      externalReference: params.externalReference,
    }),
  });
}

/** @deprecated Use createPayment. Mantido para compatibilidade. */
export async function createPixPayment(params: {
  customerId: string;
  value: number;
  externalReference: string;
  dueDate?: string;
}): Promise<AsaasPayment> {
  return createPayment({ ...params, billingType: 'PIX' });
}

export async function getPayment(paymentId: string): Promise<AsaasPayment> {
  return asaasRequest<AsaasPayment>(`/payments/${paymentId}`);
}

export async function getPixQrCode(paymentId: string): Promise<AsaasPixQrCode> {
  return asaasRequest<AsaasPixQrCode>(`/payments/${paymentId}/pixQrCode`);
}
