import type { Invoice, InvoiceLineItem, InvoiceStatus, Payment } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export type InvoiceLineInput = {
  label: string;
  quantity?: number;
  unitPriceLkr: number;
};

export function sumLineItems(items: InvoiceLineInput[]): number {
  return items.reduce((sum, item) => {
    const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
    const unit = Math.max(0, Number(item.unitPriceLkr) || 0);
    return sum + qty * unit;
  }, 0);
}

export async function nextInvoiceNumber(now = new Date()): Promise<string> {
  const ym = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const prefix = `INV-${ym}-`;
  const latest = await prisma.invoice.findFirst({
    where: { invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });
  let seq = 1;
  if (latest?.invoiceNumber) {
    const tail = latest.invoiceNumber.slice(prefix.length);
    const n = Number(tail);
    if (Number.isFinite(n)) seq = n + 1;
  }
  return `${prefix}${String(seq).padStart(3, "0")}`;
}

/** Build default line items from an accepted inquiry's proposal/itinerary. */
export async function buildDefaultInvoiceLines(inquiryId: string): Promise<InvoiceLineInput[]> {
  const inquiry = await prisma.inquiry.findUnique({
    where: { id: inquiryId },
    include: {
      tour: { select: { title: true, basePriceLkr: true, publicPriceLkr: true } },
      proposal: {
        include: {
          items: {
            orderBy: { sortOrder: "asc" },
            include: {
              tour: { select: { title: true, basePriceLkr: true, publicPriceLkr: true } },
              itinerary: {
                select: {
                  title: true,
                  grandMax: true,
                  baseTotal: true,
                  lineItems: {
                    orderBy: { sortOrder: "asc" },
                    select: { label: true, priceLkr: true, priceOnRequest: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!inquiry) return [{ label: "Tour package", unitPriceLkr: 0, quantity: 1 }];

  const lines: InvoiceLineInput[] = [];

  if (inquiry.proposal?.items?.length) {
    for (const item of inquiry.proposal.items) {
      if (item.itinerary) {
        const priced = item.itinerary.lineItems.filter(
          (li) => !li.priceOnRequest && li.priceLkr != null && Number(li.priceLkr) > 0
        );
        if (priced.length > 0) {
          for (const li of priced) {
            lines.push({
              label: li.label,
              quantity: 1,
              unitPriceLkr: Number(li.priceLkr),
            });
          }
        } else {
          const amount = Number(item.itinerary.grandMax) || Number(item.itinerary.baseTotal) || 0;
          lines.push({
            label: item.itinerary.title || "Custom itinerary",
            quantity: 1,
            unitPriceLkr: amount,
          });
        }
      } else if (item.tour) {
        const price =
          item.tour.publicPriceLkr != null
            ? Number(item.tour.publicPriceLkr)
            : Number(item.tour.basePriceLkr) || 0;
        lines.push({
          label: item.tour.title,
          quantity: Math.max(1, inquiry.pax),
          unitPriceLkr: price,
        });
      }
    }
  }

  if (lines.length === 0 && inquiry.tour) {
    const price =
      inquiry.tour.publicPriceLkr != null
        ? Number(inquiry.tour.publicPriceLkr)
        : Number(inquiry.tour.basePriceLkr) || 0;
    lines.push({
      label: inquiry.tour.title,
      quantity: Math.max(1, inquiry.pax),
      unitPriceLkr: price,
    });
  }

  if (lines.length === 0) {
    lines.push({ label: "Tour package", quantity: 1, unitPriceLkr: 0 });
  }

  return lines;
}

export function serializeInvoice(
  invoice: Invoice & {
    lineItems?: InvoiceLineItem[];
    payments?: Payment[];
  }
) {
  const lineItems = (invoice.lineItems ?? [])
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((li) => ({
      id: li.id,
      label: li.label,
      quantity: li.quantity,
      unitPriceLkr: Number(li.unitPriceLkr),
      amountLkr: Number(li.amountLkr),
      sortOrder: li.sortOrder,
    }));

  return {
    id: invoice.id,
    inquiryId: invoice.inquiryId,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status as InvoiceStatus,
    subtotalLkr: Number(invoice.subtotalLkr),
    voucherId: invoice.voucherId,
    voucherCode: invoice.voucherCode,
    voucherDiscountLkr: Number(invoice.voucherDiscountLkr),
    totalLkr: Number(invoice.totalLkr),
    currency: invoice.currency,
    notes: invoice.notes,
    sentAt: invoice.sentAt?.toISOString() ?? null,
    paidAt: invoice.paidAt?.toISOString() ?? null,
    createdById: invoice.createdById,
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString(),
    lineItems,
    latestPayment: invoice.payments?.[0]
      ? {
          id: invoice.payments[0].id,
          status: invoice.payments[0].status,
          amountLkr: Number(invoice.payments[0].amountLkr),
          provider: invoice.payments[0].provider,
          providerRef: invoice.payments[0].providerRef,
          paidAt: invoice.payments[0].paidAt?.toISOString() ?? null,
        }
      : null,
  };
}
