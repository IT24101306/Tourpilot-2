import { Router } from "express";
import { z } from "zod";
import { InquiryMessageKind, InvoiceStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { authRequired, requireRoles } from "../middleware/auth.js";
import { config } from "../lib/config.js";
import {
  buildPayHereCheckoutFields,
  payHereCheckoutUrl,
  payHereConfigured,
} from "../lib/payhere.js";
import {
  buildDefaultInvoiceLines,
  nextInvoiceNumber,
  serializeInvoice,
  sumLineItems,
  type InvoiceLineInput,
} from "../services/invoices.js";
import {
  computeVoucherDiscountLkr,
  isVoucherCurrentlyValid,
  normalizeVoucherCode,
} from "../services/vouchers.js";
import { createInquiryMessage } from "../services/inquiryMessages.js";

export const invoicesRouter = Router();

const lineItemSchema = z.object({
  label: z.string().trim().min(1).max(255),
  quantity: z.number().int().min(1).max(999).optional().default(1),
  unitPriceLkr: z.number().min(0),
});

const upsertBodySchema = z.object({
  lineItems: z.array(lineItemSchema).min(1).max(100).optional(),
  notes: z.string().trim().max(4000).optional().nullable(),
  send: z.boolean().optional().default(false),
});

function assertAgencyOwnsInquiry(
  inquiry: { agencyId: string; agency?: { ownerId: string } | null },
  userId: string
) {
  return inquiry.agency?.ownerId === userId;
}

async function loadInquiryForAgency(inquiryId: string, userId: string) {
  const inquiry = await prisma.inquiry.findUnique({
    where: { id: inquiryId },
    include: {
      agency: { select: { id: true, ownerId: true, name: true } },
      tourist: { select: { id: true, name: true, email: true, phone: true } },
      invoice: {
        include: {
          lineItems: true,
          payments: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
  });
  if (!inquiry) return { ok: false as const, error: "Inquiry not found", status: 404 as const };
  if (!assertAgencyOwnsInquiry(inquiry, userId)) {
    return { ok: false as const, error: "Forbidden", status: 403 as const };
  }
  return { ok: true as const, inquiry };
}

async function loadInquiryForTourist(inquiryId: string, userId: string) {
  const inquiry = await prisma.inquiry.findUnique({
    where: { id: inquiryId },
    include: {
      tourist: { select: { id: true, name: true, email: true, phone: true } },
      agency: { select: { id: true, name: true, slug: true } },
      invoice: {
        include: {
          lineItems: true,
          payments: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
  });
  if (!inquiry) return { ok: false as const, error: "Inquiry not found", status: 404 as const };
  if (inquiry.touristId !== userId) {
    return { ok: false as const, error: "Forbidden", status: 403 as const };
  }
  return { ok: true as const, inquiry };
}

function normalizeLines(items: z.infer<typeof lineItemSchema>[]): InvoiceLineInput[] {
  return items.map((item) => ({
    label: item.label.trim(),
    quantity: item.quantity ?? 1,
    unitPriceLkr: item.unitPriceLkr,
  }));
}

/** Agency: preview auto-calculated lines for a confirmed inquiry. */
invoicesRouter.get(
  "/inquiries/:inquiryId/preview",
  authRequired,
  requireRoles("AGENCY"),
  async (req, res, next) => {
    try {
      const inquiryId = String(req.params.inquiryId);
      const loaded = await loadInquiryForAgency(inquiryId, req.user!.id);
      if (!loaded.ok) return res.status(loaded.status).json({ error: loaded.error });
      if (loaded.inquiry.status !== "ACCEPTED") {
        return res.status(400).json({ error: "Invoice can only be generated after the tourist confirms" });
      }
      const lineItems = await buildDefaultInvoiceLines(loaded.inquiry.id);
      const subtotalLkr = sumLineItems(lineItems);
      res.json({
        inquiryId: loaded.inquiry.id,
        lineItems: lineItems.map((li, idx) => ({
          ...li,
          amountLkr: (li.quantity ?? 1) * li.unitPriceLkr,
          sortOrder: idx,
        })),
        subtotalLkr,
        existing: loaded.inquiry.invoice ? serializeInvoice(loaded.inquiry.invoice) : null,
      });
    } catch (err) {
      next(err);
    }
  }
);

/** Agency: create or update invoice (optionally send to tourist). */
invoicesRouter.post(
  "/inquiries/:inquiryId",
  authRequired,
  requireRoles("AGENCY"),
  async (req, res, next) => {
    try {
      const inquiryId = String(req.params.inquiryId);
      const loaded = await loadInquiryForAgency(inquiryId, req.user!.id);
      if (!loaded.ok) return res.status(loaded.status).json({ error: loaded.error });
      const { inquiry } = loaded;

      if (inquiry.status !== "ACCEPTED") {
        return res.status(400).json({ error: "Invoice can only be generated after the tourist confirms" });
      }
      if (inquiry.invoice?.status === "PAID") {
        return res.status(400).json({ error: "This invoice is already paid and cannot be edited" });
      }

      const body = upsertBodySchema.parse(req.body);
      const rawLines =
        body.lineItems && body.lineItems.length > 0
          ? normalizeLines(body.lineItems)
          : await buildDefaultInvoiceLines(inquiry.id);
      const subtotalLkr = sumLineItems(rawLines);
      const send = Boolean(body.send);
      const nextStatus: InvoiceStatus = send ? "SENT" : inquiry.invoice?.status === "SENT" ? "SENT" : "DRAFT";

      // Keep existing voucher discount if still applicable after price edits.
      let voucherId = inquiry.invoice?.voucherId ?? null;
      let voucherCode = inquiry.invoice?.voucherCode ?? null;
      let voucherDiscountLkr = 0;
      if (voucherId) {
        const voucher = await prisma.voucher.findUnique({ where: { id: voucherId } });
        if (voucher) {
          const valid = isVoucherCurrentlyValid(voucher);
          if (valid.ok) {
            voucherDiscountLkr = computeVoucherDiscountLkr(subtotalLkr, voucher);
            voucherCode = voucher.code;
          } else {
            voucherId = null;
            voucherCode = null;
          }
        } else {
          voucherId = null;
          voucherCode = null;
        }
      }
      const totalLkr = Math.max(0, subtotalLkr - voucherDiscountLkr);

      const invoice = await prisma.$transaction(async (tx) => {
        let inv = inquiry.invoice;
        if (!inv) {
          const invoiceNumber = await nextInvoiceNumber();
          inv = await tx.invoice.create({
            data: {
              inquiryId: inquiry.id,
              invoiceNumber,
              status: nextStatus,
              subtotalLkr,
              voucherId,
              voucherCode,
              voucherDiscountLkr,
              totalLkr,
              notes: body.notes ?? null,
              sentAt: send ? new Date() : null,
              createdById: req.user!.id,
              lineItems: {
                create: rawLines.map((li, idx) => {
                  const qty = li.quantity ?? 1;
                  return {
                    label: li.label,
                    quantity: qty,
                    unitPriceLkr: li.unitPriceLkr,
                    amountLkr: qty * li.unitPriceLkr,
                    sortOrder: idx,
                  };
                }),
              },
            },
            include: {
              lineItems: true,
              payments: { orderBy: { createdAt: "desc" }, take: 1 },
            },
          });
        } else {
          await tx.invoiceLineItem.deleteMany({ where: { invoiceId: inv.id } });
          inv = await tx.invoice.update({
            where: { id: inv.id },
            data: {
              status: nextStatus,
              subtotalLkr,
              voucherId,
              voucherCode,
              voucherDiscountLkr,
              totalLkr,
              notes: body.notes === undefined ? inv.notes : body.notes,
              sentAt: send ? new Date() : inv.sentAt,
              lineItems: {
                create: rawLines.map((li, idx) => {
                  const qty = li.quantity ?? 1;
                  return {
                    label: li.label,
                    quantity: qty,
                    unitPriceLkr: li.unitPriceLkr,
                    amountLkr: qty * li.unitPriceLkr,
                    sortOrder: idx,
                  };
                }),
              },
            },
            include: {
              lineItems: true,
              payments: { orderBy: { createdAt: "desc" }, take: 1 },
            },
          });
        }

        if (send) {
          await createInquiryMessage(
            inquiry.id,
            req.user!.id,
            InquiryMessageKind.AGENCY,
            `Invoice ${inv.invoiceNumber} is ready — total LKR ${Number(inv.totalLkr).toLocaleString()}.`,
            "INVOICE_SENT"
          );
        }

        return inv;
      });

      res.status(inquiry.invoice ? 200 : 201).json(serializeInvoice(invoice));
    } catch (err) {
      next(err);
    }
  }
);

/** Shared: get invoice for an inquiry (agency owner or tourist). */
invoicesRouter.get(
  "/inquiries/:inquiryId",
  authRequired,
  requireRoles("AGENCY", "TOURIST", "ADMIN"),
  async (req, res, next) => {
    try {
      const inquiryId = String(req.params.inquiryId);
      const role = req.user!.role;
      if (role === "AGENCY") {
        const loaded = await loadInquiryForAgency(inquiryId, req.user!.id);
        if (!loaded.ok) return res.status(loaded.status).json({ error: loaded.error });
        if (!loaded.inquiry.invoice) return res.status(404).json({ error: "No invoice yet" });
        return res.json(serializeInvoice(loaded.inquiry.invoice));
      }
      if (role === "TOURIST") {
        const loaded = await loadInquiryForTourist(inquiryId, req.user!.id);
        if (!loaded.ok) return res.status(loaded.status).json({ error: loaded.error });
        if (!loaded.inquiry.invoice || !["SENT", "PAID"].includes(loaded.inquiry.invoice.status)) {
          return res.status(404).json({ error: "No invoice available" });
        }
        return res.json(serializeInvoice(loaded.inquiry.invoice));
      }
      // ADMIN
      const inquiry = await prisma.inquiry.findUnique({
        where: { id: inquiryId },
        include: {
          invoice: {
            include: {
              lineItems: true,
              payments: { orderBy: { createdAt: "desc" }, take: 1 },
            },
          },
        },
      });
      if (!inquiry?.invoice) return res.status(404).json({ error: "No invoice yet" });
      res.json(serializeInvoice(inquiry.invoice));
    } catch (err) {
      next(err);
    }
  }
);

/** Tourist: redeem / clear voucher on a SENT invoice. */
invoicesRouter.post(
  "/:invoiceId/redeem-voucher",
  authRequired,
  requireRoles("TOURIST"),
  async (req, res, next) => {
    try {
      const body = z
        .object({
          code: z.string().trim().max(64).optional().nullable(),
          clear: z.boolean().optional().default(false),
        })
        .parse(req.body);

      const invoice = await prisma.invoice.findUnique({
        where: { id: req.params.invoiceId },
        include: {
          inquiry: { select: { touristId: true } },
          lineItems: true,
          payments: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      });
      if (!invoice) return res.status(404).json({ error: "Invoice not found" });
      if (invoice.inquiry.touristId !== req.user!.id) {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (invoice.status !== "SENT") {
        return res.status(400).json({ error: "Vouchers can only be applied to unpaid invoices" });
      }

      const subtotalLkr = Number(invoice.subtotalLkr);

      if (body.clear || !body.code?.trim()) {
        // Remove prior redemption if any
        await prisma.$transaction(async (tx) => {
          const existing = await tx.voucherRedemption.findUnique({ where: { invoiceId: invoice.id } });
          if (existing) {
            await tx.voucherRedemption.delete({ where: { id: existing.id } });
            await tx.voucher.update({
              where: { id: existing.voucherId },
              data: { usedCount: { decrement: 1 } },
            });
          }
          await tx.invoice.update({
            where: { id: invoice.id },
            data: {
              voucherId: null,
              voucherCode: null,
              voucherDiscountLkr: 0,
              totalLkr: subtotalLkr,
            },
          });
        });
        const refreshed = await prisma.invoice.findUniqueOrThrow({
          where: { id: invoice.id },
          include: {
            lineItems: true,
            payments: { orderBy: { createdAt: "desc" }, take: 1 },
          },
        });
        return res.json(serializeInvoice(refreshed));
      }

      const code = normalizeVoucherCode(body.code);
      const voucher = await prisma.voucher.findUnique({ where: { code } });
      if (!voucher) return res.status(404).json({ error: "Invalid voucher code" });
      const valid = isVoucherCurrentlyValid(voucher);
      if (!valid.ok) return res.status(400).json({ error: valid.error });

      const discountLkr = computeVoucherDiscountLkr(subtotalLkr, voucher);
      if (discountLkr <= 0) {
        return res.status(400).json({
          error:
            voucher.minInvoiceLkr != null
              ? `This voucher requires a minimum invoice of LKR ${Number(voucher.minInvoiceLkr).toLocaleString()}`
              : "This voucher does not apply to the current invoice total",
        });
      }
      const totalLkr = Math.max(0, subtotalLkr - discountLkr);

      await prisma.$transaction(async (tx) => {
        const existing = await tx.voucherRedemption.findUnique({ where: { invoiceId: invoice.id } });
        if (existing) {
          if (existing.voucherId !== voucher.id) {
            await tx.voucher.update({
              where: { id: existing.voucherId },
              data: { usedCount: { decrement: 1 } },
            });
            await tx.voucherRedemption.update({
              where: { id: existing.id },
              data: {
                voucherId: voucher.id,
                touristId: req.user!.id,
                discountLkr,
              },
            });
            await tx.voucher.update({
              where: { id: voucher.id },
              data: { usedCount: { increment: 1 } },
            });
          } else {
            await tx.voucherRedemption.update({
              where: { id: existing.id },
              data: { discountLkr },
            });
          }
        } else {
          await tx.voucherRedemption.create({
            data: {
              voucherId: voucher.id,
              invoiceId: invoice.id,
              touristId: req.user!.id,
              discountLkr,
            },
          });
          await tx.voucher.update({
            where: { id: voucher.id },
            data: { usedCount: { increment: 1 } },
          });
        }

        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            voucherId: voucher.id,
            voucherCode: voucher.code,
            voucherDiscountLkr: discountLkr,
            totalLkr,
          },
        });
      });

      const refreshed = await prisma.invoice.findUniqueOrThrow({
        where: { id: invoice.id },
        include: {
          lineItems: true,
          payments: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      });
      res.json(serializeInvoice(refreshed));
    } catch (err) {
      next(err);
    }
  }
);

/** Tourist: start checkout (PayHere when configured, otherwise demo checkout). */
invoicesRouter.post(
  "/:invoiceId/checkout",
  authRequired,
  requireRoles("TOURIST"),
  async (req, res, next) => {
    try {
      const invoice = await prisma.invoice.findUnique({
        where: { id: req.params.invoiceId },
        include: {
          inquiry: {
            include: {
              tourist: { select: { id: true, name: true, email: true, phone: true } },
              agency: { select: { name: true } },
            },
          },
          lineItems: true,
        },
      });
      if (!invoice) return res.status(404).json({ error: "Invoice not found" });
      if (invoice.inquiry.touristId !== req.user!.id) {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (invoice.status === "PAID") {
        return res.status(400).json({ error: "This invoice is already paid" });
      }
      if (invoice.status !== "SENT") {
        return res.status(400).json({ error: "Invoice is not ready for payment" });
      }

      const amountLkr = Number(invoice.totalLkr);
      if (amountLkr <= 0) {
        // Zero-total invoices (fully covered by voucher) can be marked paid immediately.
        const paid = await prisma.invoice.update({
          where: { id: invoice.id },
          data: { status: "PAID", paidAt: new Date() },
          include: {
            lineItems: true,
            payments: { orderBy: { createdAt: "desc" }, take: 1 },
          },
        });
        return res.json({
          mode: "zero_total",
          invoice: serializeInvoice(paid),
          redirectUrl: `${config.webAppUrl}/trips?room=${invoice.inquiryId}&paid=1`,
        });
      }

      const payment = await prisma.payment.create({
        data: {
          invoiceId: invoice.id,
          amountLkr,
          currency: invoice.currency,
          status: "PENDING",
          provider: payHereConfigured() ? "payhere" : "demo",
        },
      });

      const returnUrl = `${config.webAppUrl}/checkout/${invoice.id}/return`;
      const cancelUrl = `${config.webAppUrl}/checkout/${invoice.id}/cancel`;
      const notifyUrl = `${config.webAppUrl}/api/invoices/payhere/notify`;

      const nameParts = (invoice.inquiry.tourist.name || "Guest Traveler").trim().split(/\s+/);
      const firstName = nameParts[0] || "Guest";
      const lastName = nameParts.slice(1).join(" ") || "Traveler";

      const payHereFields = buildPayHereCheckoutFields({
        orderId: payment.id,
        amountLkr,
        itemTitle: `Invoice ${invoice.invoiceNumber} — ${invoice.inquiry.agency.name}`,
        returnUrl,
        cancelUrl,
        notifyUrl,
        customer: {
          firstName,
          lastName,
          email: invoice.inquiry.tourist.email || "",
          phone: invoice.inquiry.tourist.phone || "",
        },
      });

      if (payHereFields) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            checkoutUrl: payHereCheckoutUrl(),
            metadata: { fields: payHereFields },
          },
        });
        return res.json({
          mode: "payhere",
          paymentId: payment.id,
          checkoutUrl: payHereCheckoutUrl(),
          fields: payHereFields,
          redirectUrl: `${config.webAppUrl}/checkout/${invoice.id}?payment=${payment.id}`,
        });
      }

      // Demo / stub gateway until PayHere credentials are configured.
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          checkoutUrl: `${config.webAppUrl}/checkout/${invoice.id}?payment=${payment.id}`,
        },
      });

      res.json({
        mode: "demo",
        paymentId: payment.id,
        redirectUrl: `${config.webAppUrl}/checkout/${invoice.id}?payment=${payment.id}`,
      });
    } catch (err) {
      next(err);
    }
  }
);

/** Demo gateway: mark payment completed (only when PayHere is not configured). */
invoicesRouter.post(
  "/:invoiceId/demo-complete",
  authRequired,
  requireRoles("TOURIST"),
  async (req, res, next) => {
    try {
      if (payHereConfigured()) {
        return res.status(400).json({ error: "Demo checkout is disabled when PayHere is configured" });
      }
      const body = z.object({ paymentId: z.string().min(1) }).parse(req.body);
      const payment = await prisma.payment.findUnique({
        where: { id: body.paymentId },
        include: {
          invoice: {
            include: {
              inquiry: { select: { touristId: true, id: true } },
              lineItems: true,
              payments: { orderBy: { createdAt: "desc" }, take: 1 },
            },
          },
        },
      });
      if (!payment || payment.invoiceId !== req.params.invoiceId) {
        return res.status(404).json({ error: "Payment not found" });
      }
      if (payment.invoice.inquiry.touristId !== req.user!.id) {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (payment.status === "COMPLETED") {
        return res.json({
          invoice: serializeInvoice(payment.invoice),
          redirectUrl: `${config.webAppUrl}/trips?room=${payment.invoice.inquiry.id}&paid=1`,
        });
      }

      const updated = await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: "COMPLETED",
            paidAt: new Date(),
            providerRef: `demo-${payment.id}`,
          },
        });
        return tx.invoice.update({
          where: { id: payment.invoiceId },
          data: { status: "PAID", paidAt: new Date() },
          include: {
            lineItems: true,
            payments: { orderBy: { createdAt: "desc" }, take: 1 },
          },
        });
      });

      res.json({
        invoice: serializeInvoice(updated),
        redirectUrl: `${config.webAppUrl}/trips?room=${payment.invoice.inquiry.id}&paid=1`,
      });
    } catch (err) {
      next(err);
    }
  }
);

/** PayHere server notify (no auth — verified by merchant_id + status). */
invoicesRouter.post("/payhere/notify", async (req, res, next) => {
  try {
    const orderId = String(req.body?.order_id || "");
    const statusCode = String(req.body?.status_code || "");
    const paymentId = String(req.body?.payment_id || "");
    if (!orderId) return res.status(400).send("missing order_id");

    const payment = await prisma.payment.findUnique({
      where: { id: orderId },
      include: { invoice: true },
    });
    if (!payment) return res.status(404).send("unknown order");

    if (statusCode === "2") {
      await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: "COMPLETED",
            providerRef: paymentId || payment.providerRef,
            paidAt: new Date(),
            metadata: req.body as object,
          },
        });
        await tx.invoice.update({
          where: { id: payment.invoiceId },
          data: { status: "PAID", paidAt: new Date() },
        });
      });
    } else if (statusCode === "0" || statusCode === "-1" || statusCode === "-2") {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: statusCode === "0" ? "PENDING" : "FAILED",
          metadata: req.body as object,
        },
      });
    }

    res.status(200).send("OK");
  } catch (err) {
    next(err);
  }
});

/** Checkout page data for tourist. */
invoicesRouter.get(
  "/:invoiceId/checkout-session",
  authRequired,
  requireRoles("TOURIST"),
  async (req, res, next) => {
    try {
      const paymentId = typeof req.query.payment === "string" ? req.query.payment : undefined;
      const invoice = await prisma.invoice.findUnique({
        where: { id: req.params.invoiceId },
        include: {
          inquiry: {
            select: {
              id: true,
              touristId: true,
              agency: { select: { name: true } },
            },
          },
          lineItems: true,
          payments: {
            where: paymentId ? { id: paymentId } : undefined,
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });
      if (!invoice) return res.status(404).json({ error: "Invoice not found" });
      if (invoice.inquiry.touristId !== req.user!.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const payment = invoice.payments[0] ?? null;
      const meta = (payment?.metadata as { fields?: Record<string, string> } | null) ?? null;

      res.json({
        invoice: serializeInvoice(invoice),
        payment: payment
          ? {
              id: payment.id,
              status: payment.status,
              provider: payment.provider,
              amountLkr: Number(payment.amountLkr),
            }
          : null,
        mode: payHereConfigured() ? "payhere" : "demo",
        payHere: meta?.fields
          ? { checkoutUrl: payHereCheckoutUrl(), fields: meta.fields }
          : null,
        agencyName: invoice.inquiry.agency.name,
        tripRoomUrl: `/trips?room=${invoice.inquiry.id}`,
      });
    } catch (err) {
      next(err);
    }
  }
);
