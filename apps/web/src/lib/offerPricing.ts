export function isFreeOffer(discountedLkr: number | null | undefined): boolean {
  return discountedLkr === 0;
}

export function offerPriceFromTours(
  tourIds: string[],
  tours: Array<{ id: string; basePriceLkr: number }>
): number {
  if (tourIds.length === 0) return 0;
  return Math.max(
    0,
    ...tourIds.map((id) => tours.find((t) => t.id === id)?.basePriceLkr ?? 0)
  );
}
