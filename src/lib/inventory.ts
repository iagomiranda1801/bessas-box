export type VariantStock = {
  availableForSale: boolean;
  quantityAvailable: number | null;
};

/**
 * Limite vendável.
 * Se a API não informar quantidade (`null`), assume no máximo 1 unidade (conservador).
 */
export function getMaxPurchasableQuantity(variant: VariantStock): number {
  if (!variant.availableForSale) return 0;
  if (variant.quantityAvailable == null) return 1;
  return Math.max(0, variant.quantityAvailable);
}

export function stockMessageForAdd(
  max: number,
  alreadyInCart: number,
): string {
  if (max === 0) return 'Este produto está esgotado.';
  const canAdd = Math.max(0, max - alreadyInCart);
  if (canAdd === 0) {
    return max === 1
      ? 'Você já tem a única unidade disponível na sacola.'
      : `Você já tem o máximo (${max} unidades) na sacola.`;
  }
  if (canAdd === 1) return 'Só há mais 1 unidade disponível.';
  return `Só há ${canAdd} unidades disponíveis para adicionar.`;
}

export function stockMessageForQuantity(max: number): string {
  if (max === 0) return 'Este produto está esgotado.';
  if (max === 1) return 'Só há 1 unidade em estoque.';
  return `Só há ${max} unidades em estoque.`;
}

export function validateRequestedQuantity(
  requestedTotal: number,
  max: number,
): { ok: true } | { ok: false; message: string; cappedQuantity: number } {
  if (requestedTotal < 1) {
    return { ok: false, message: 'Quantidade inválida.', cappedQuantity: 0 };
  }
  if (requestedTotal <= max) return { ok: true };
  return {
    ok: false,
    message: stockMessageForQuantity(max),
    cappedQuantity: max,
  };
}
