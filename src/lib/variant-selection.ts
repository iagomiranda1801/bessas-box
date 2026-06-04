type VariantOption = { name: string; value: string };

export type VariantLike = {
  id: string;
  title: string;
  availableForSale: boolean;
  quantityAvailable: number | null;
  selectedOptions: VariantOption[];
};

export function getOptionValues(variants: VariantLike[], optionName: string): string[] {
  const values: string[] = [];
  const seen = new Set<string>();
  for (const v of variants) {
    const value = v.selectedOptions.find((o) => o.name === optionName)?.value;
    if (value && !seen.has(value)) {
      seen.add(value);
      values.push(value);
    }
  }
  return values;
}

export function findVariantByOptions(
  variants: VariantLike[],
  color: string,
  size: string,
): VariantLike | undefined {
  return variants.find((v) => {
    const c = v.selectedOptions.find((o) => o.name === 'Cor')?.value;
    const s = v.selectedOptions.find((o) => o.name === 'Tamanho')?.value;
    return c === color && s === size;
  });
}

export function firstAvailableColor(variants: VariantLike[]): string | null {
  const colors = getOptionValues(variants, 'Cor');
  for (const color of colors) {
    if (variants.some((v) => v.selectedOptions.find((o) => o.name === 'Cor')?.value === color && v.availableForSale)) {
      return color;
    }
  }
  return colors[0] ?? null;
}

export function firstAvailableSizeForColor(
  variants: VariantLike[],
  color: string,
): string | null {
  const sizes = getOptionValues(
    variants.filter((v) => v.selectedOptions.find((o) => o.name === 'Cor')?.value === color),
    'Tamanho',
  );
  for (const size of sizes) {
    const v = findVariantByOptions(variants, color, size);
    if (v?.availableForSale) return size;
  }
  return sizes[0] ?? null;
}

export function initialVariantSelection(variants: VariantLike[]): {
  color: string | null;
  size: string | null;
  variant: VariantLike | undefined;
} {
  if (variants.length === 0) {
    return { color: null, size: null, variant: undefined };
  }
  const color = firstAvailableColor(variants);
  const size = color ? firstAvailableSizeForColor(variants, color) : null;
  const variant =
    color && size ? findVariantByOptions(variants, color, size) : variants[0];
  return { color, size, variant };
}
