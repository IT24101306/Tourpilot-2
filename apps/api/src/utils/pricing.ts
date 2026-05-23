import type { LineItemKind } from "@prisma/client";

export type PriceLine = {
  kind: LineItemKind;
  priceLkr: number | null;
  priceOnRequest?: boolean;
};

export function calculateItineraryTotals(lines: PriceLine[]) {
  let baseTotal = 0;
  let optionalTotal = 0;

  for (const line of lines) {
    if (line.priceOnRequest || line.priceLkr == null) continue;
    if (line.kind === "REQUIRED") baseTotal += line.priceLkr;
    else optionalTotal += line.priceLkr;
  }

  return {
    baseTotal,
    optionalTotal,
    grandMax: baseTotal + optionalTotal,
  };
}
