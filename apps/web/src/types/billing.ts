export type InvoiceLineItem = {
  id?: string;
  label: string;
  quantity: number;
  unitPriceLkr: number;
  amountLkr: number;
  sortOrder?: number;
};

export type InvoiceSummary = {
  id: string;
  invoiceNumber: string;
  status: "DRAFT" | "SENT" | "PAID" | "CANCELLED" | string;
  subtotalLkr: number;
  voucherCode: string | null;
  voucherDiscountLkr: number;
  totalLkr: number;
  sentAt: string | null;
  paidAt: string | null;
};

export type InvoiceDetail = InvoiceSummary & {
  inquiryId: string;
  currency: string;
  notes: string | null;
  voucherId: string | null;
  createdAt: string;
  updatedAt: string;
  lineItems: InvoiceLineItem[];
  latestPayment?: {
    id: string;
    status: string;
    amountLkr: number;
    provider: string;
    providerRef: string | null;
    paidAt: string | null;
  } | null;
};

export type VoucherRow = {
  id: string;
  code: string;
  description: string | null;
  discountType: "FIXED_LKR" | "PERCENT";
  discountValue: number;
  maxUses: number | null;
  usedCount: number;
  minInvoiceLkr: number | null;
  maxDiscountLkr: number | null;
  validFrom: string | null;
  validUntil: string | null;
  isActive: boolean;
  createdAt: string;
};
