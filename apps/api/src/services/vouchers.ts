import type { Voucher, VoucherDiscountType } from "@prisma/client";

export function normalizeVoucherCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "-");
}

export function computeVoucherDiscountLkr(
  subtotalLkr: number,
  voucher: Pick<Voucher, "discountType" | "discountValue" | "maxDiscountLkr" | "minInvoiceLkr">
): number {
  const subtotal = Math.max(0, Number(subtotalLkr) || 0);
  const minInvoice = voucher.minInvoiceLkr != null ? Number(voucher.minInvoiceLkr) : 0;
  if (subtotal < minInvoice) return 0;

  const value = Number(voucher.discountValue) || 0;
  let discount = 0;
  if ((voucher.discountType as VoucherDiscountType) === "PERCENT") {
    discount = Math.round((subtotal * value) / 100);
  } else {
    discount = Math.round(value);
  }

  if (voucher.maxDiscountLkr != null) {
    discount = Math.min(discount, Number(voucher.maxDiscountLkr));
  }

  return Math.max(0, Math.min(discount, subtotal));
}

export function isVoucherCurrentlyValid(
  voucher: Pick<Voucher, "isActive" | "validFrom" | "validUntil" | "maxUses" | "usedCount">,
  now = new Date()
): { ok: true } | { ok: false; error: string } {
  if (!voucher.isActive) return { ok: false, error: "This voucher is no longer active" };
  if (voucher.validFrom && voucher.validFrom > now) {
    return { ok: false, error: "This voucher is not valid yet" };
  }
  if (voucher.validUntil && voucher.validUntil < now) {
    return { ok: false, error: "This voucher has expired" };
  }
  if (voucher.maxUses != null && voucher.usedCount >= voucher.maxUses) {
    return { ok: false, error: "This voucher has reached its usage limit" };
  }
  return { ok: true };
}

export function serializeVoucher(voucher: Voucher) {
  return {
    id: voucher.id,
    code: voucher.code,
    description: voucher.description,
    discountType: voucher.discountType,
    discountValue: Number(voucher.discountValue),
    maxUses: voucher.maxUses,
    usedCount: voucher.usedCount,
    minInvoiceLkr: voucher.minInvoiceLkr != null ? Number(voucher.minInvoiceLkr) : null,
    maxDiscountLkr: voucher.maxDiscountLkr != null ? Number(voucher.maxDiscountLkr) : null,
    validFrom: voucher.validFrom?.toISOString() ?? null,
    validUntil: voucher.validUntil?.toISOString() ?? null,
    isActive: voucher.isActive,
    createdById: voucher.createdById,
    createdAt: voucher.createdAt.toISOString(),
    updatedAt: voucher.updatedAt.toISOString(),
  };
}
