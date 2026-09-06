export type StockHealth =
  | 'OUT_OF_STOCK'
  | 'CRITICAL'
  | 'LOW'
  | 'HEALTHY'
  | 'UNCONFIGURED';

export function classifyStockHealth(currentQuantity: number, reorderPoint: number | null): StockHealth {
  if (currentQuantity === 0) {
    return 'OUT_OF_STOCK';
  }

  if (reorderPoint === null) {
    return 'UNCONFIGURED';
  }

  if (currentQuantity <= Math.floor(reorderPoint / 2)) {
    return 'CRITICAL';
  }

  if (currentQuantity <= reorderPoint) {
    return 'LOW';
  }

  return 'HEALTHY';
}

export function recommendedReorderQuantity(
  currentQuantity: number,
  reorderPoint: number | null,
): number | null {
  if (reorderPoint === null) {
    return null;
  }

  return Math.max(reorderPoint - currentQuantity, 0);
}
