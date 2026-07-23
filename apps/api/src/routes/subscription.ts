import { Router } from "express";
import { z } from "zod";
import { createHash } from "node:crypto";
import {
  DEFAULT_PRICING_PAGE,
  parsePricingPageContent,
  type PricingPageContent,
} from "@tourpilot/shared";
import { prisma } from "../lib/prisma.js";
import { authRequired, requireRoles, getAgencyForUser } from "../middleware/auth.js";
import { config } from "../lib/config.js";
import {
  buildPayHereCheckoutFields,
  payHereCheckoutUrl,
  payHereConfigured,
} from "../lib/payhere.js";
import {
  activateSelectedPackage,
  buildTrialStatus,
  fulfillSubscriptionPayment,
  parseSelectedPackage,
  trialUserUpdateData,
} from "../services/trial.js";
import { asJson } from "../utils/json.js";

export const subscriptionRouter = Router();

async function loadPricingPackages() {
  const page = await prisma.cmsPage.findUnique({ where: { slug: "pricing" } });
  let content: PricingPageContent = structuredClone(DEFAULT_PRICING_PAGE);
  if (page?.blocks) {
    const blocks = page.blocks as unknown;
    if (Array.isArray(blocks)) {
      content = parsePricingPageContent(blocks);
    } else if (blocks && typeof blocks === "object") {
      content = parsePricingPageContent([blocks]);
    }
  }
  return content.packages ?? [];
}

function serializePayment(row: {
  id: string;
  packageId: string;
  packageName: string;
  amountLkr: unknown;
  currency: string;
  status: string;
  provider: string;
  payhereOrderId: string | null;
  paidAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    packageId: row.packageId,
    packageName: row.packageName,
    amountLkr: Math.round(Number(row.amountLkr)),
    currency: row.currency,
    status: row.status,
    provider: row.provider,
    payhereOrderId: row.payhereOrderId,
    paidAt: row.paidAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

subscriptionRouter.get("/", authRequired, requireRoles("AGENCY"), async (req, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    const packages = await loadPricingPackages();
    res.json({
      trial: buildTrialStatus(user),
      autoRenew: user.subscriptionAutoRenew !== false,
      periodEnd: user.subscriptionPeriodEnd?.toISOString() ?? null,
      walletBalance: Number(user.walletBalance),
      packages: packages.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        priceLkr: p.priceLkr ?? null,
        priceLabel: p.priceLabel ?? p.price,
        billing: p.billing ?? null,
      })),
    });
  } catch (e) {
    next(e);
  }
});

subscriptionRouter.patch(
  "/auto-renew",
  authRequired,
  requireRoles("AGENCY"),
  async (req, res, next) => {
    try {
      const body = z.object({ autoRenew: z.boolean() }).parse(req.body);
      const user = await prisma.user.update({
        where: { id: req.user!.id },
        data: { subscriptionAutoRenew: body.autoRenew },
      });
      res.json({
        autoRenew: user.subscriptionAutoRenew,
        trial: buildTrialStatus(user),
        periodEnd: user.subscriptionPeriodEnd?.toISOString() ?? null,
      });
    } catch (e) {
      next(e);
    }
  }
);

subscriptionRouter.get(
  "/payments",
  authRequired,
  requireRoles("AGENCY"),
  async (req, res, next) => {
    try {
      const rows = await prisma.subscriptionPayment.findMany({
        where: { userId: req.user!.id },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      res.json(rows.map(serializePayment));
    } catch (e) {
      next(e);
    }
  }
);

subscriptionRouter.post(
  "/select-package",
  authRequired,
  requireRoles("AGENCY"),
  async (req, res, next) => {
    try {
      const body = z
        .object({
          packageId: z.string().min(1),
          packageName: z.string().min(1),
          priceLkr: z.number().optional(),
          priceLabel: z.string().optional(),
          billing: z.string().optional(),
        })
        .parse(req.body);
      const pkg = parseSelectedPackage(body);
      if (!pkg) return res.status(400).json({ error: "Invalid package" });

      const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
      const data = user.packageActivatedAt
        ? {
            selectedPackageId: pkg.packageId,
            selectedPackageName: pkg.packageName,
            selectedPackagePriceLkr: pkg.priceLkr,
            selectedPackagePriceLabel: pkg.priceLabel,
            selectedPackageBilling: pkg.billing,
          }
        : trialUserUpdateData(pkg);

      const updated = await prisma.user.update({
        where: { id: user.id },
        data,
      });
      res.json({
        trial: buildTrialStatus(updated),
        autoRenew: updated.subscriptionAutoRenew,
        periodEnd: updated.subscriptionPeriodEnd?.toISOString() ?? null,
      });
    } catch (e) {
      next(e);
    }
  }
);

subscriptionRouter.post(
  "/checkout",
  authRequired,
  requireRoles("AGENCY"),
  async (req, res, next) => {
    try {
      const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
      if (!user.selectedPackageId || !user.selectedPackageName) {
        return res.status(400).json({ error: "No package selected for this account" });
      }

      const billing = user.selectedPackageBilling || "MONTHLY";
      const amountLkr = Math.round(Number(user.selectedPackagePriceLkr ?? 0));

      // Zero-cost / PAYG activation without PayHere.
      if (amountLkr <= 0 || billing === "PAYG" || billing === "CUSTOM") {
        const result = await activateSelectedPackage(user.id);
        return res.json({
          mode: "activated",
          result,
          redirectUrl: `${config.webAppUrl}/profile/billing/subscriptions?activated=1`,
        });
      }

      const agency = await getAgencyForUser(user.id);
      const payment = await prisma.subscriptionPayment.create({
        data: {
          userId: user.id,
          agencyId: agency?.id ?? null,
          packageId: user.selectedPackageId,
          packageName: user.selectedPackageName,
          amountLkr,
          currency: "LKR",
          status: "PENDING",
          provider: payHereConfigured() ? "payhere" : "demo",
          payhereOrderId: null,
        },
      });

      await prisma.subscriptionPayment.update({
        where: { id: payment.id },
        data: { payhereOrderId: payment.id },
      });

      const returnUrl = `${config.webAppUrl}/profile/billing/subscriptions/return?payment=${payment.id}`;
      const cancelUrl = `${config.webAppUrl}/profile/billing/subscriptions/cancel?payment=${payment.id}`;
      const notifyUrl = `${config.webAppUrl}/api/subscription/payhere/notify`;

      const nameParts = (user.name || "Agency Owner").trim().split(/\s+/);
      const fields = buildPayHereCheckoutFields({
        orderId: payment.id,
        amountLkr,
        itemTitle: `TourPilot ${user.selectedPackageName}`,
        returnUrl,
        cancelUrl,
        notifyUrl,
        customer: {
          firstName: nameParts[0] || "Agency",
          lastName: nameParts.slice(1).join(" ") || "Owner",
          email: user.email || "",
          phone: user.phone || "",
        },
      });

      if (fields) {
        await prisma.subscriptionPayment.update({
          where: { id: payment.id },
          data: {
            checkoutUrl: payHereCheckoutUrl(),
            metadata: asJson({ fields }),
          },
        });
        return res.json({
          mode: "payhere",
          paymentId: payment.id,
          checkoutUrl: payHereCheckoutUrl(),
          fields,
          redirectUrl: `${config.webAppUrl}/profile/billing/subscriptions/checkout?payment=${payment.id}`,
        });
      }

      await prisma.subscriptionPayment.update({
        where: { id: payment.id },
        data: {
          checkoutUrl: `${config.webAppUrl}/profile/billing/subscriptions/checkout?payment=${payment.id}`,
        },
      });

      res.json({
        mode: "demo",
        paymentId: payment.id,
        redirectUrl: `${config.webAppUrl}/profile/billing/subscriptions/checkout?payment=${payment.id}`,
      });
    } catch (e) {
      next(e);
    }
  }
);

subscriptionRouter.get(
  "/checkout-session",
  authRequired,
  requireRoles("AGENCY"),
  async (req, res, next) => {
    try {
      const paymentId = String(req.query.payment || "");
      if (!paymentId) return res.status(400).json({ error: "payment required" });
      const payment = await prisma.subscriptionPayment.findUnique({ where: { id: paymentId } });
      if (!payment || payment.userId !== req.user!.id) {
        return res.status(404).json({ error: "Payment not found" });
      }
      const meta = (payment.metadata || {}) as { fields?: Record<string, string> };
      res.json({
        payment: serializePayment(payment),
        mode: payment.provider === "payhere" && payHereConfigured() ? "payhere" : "demo",
        payHere:
          meta.fields && payment.provider === "payhere"
            ? { checkoutUrl: payHereCheckoutUrl(), fields: meta.fields }
            : null,
      });
    } catch (e) {
      next(e);
    }
  }
);

subscriptionRouter.post(
  "/demo-complete",
  authRequired,
  requireRoles("AGENCY"),
  async (req, res, next) => {
    try {
      if (payHereConfigured()) {
        return res.status(400).json({ error: "Demo checkout is disabled when PayHere is configured" });
      }
      const body = z.object({ paymentId: z.string().min(1) }).parse(req.body);
      const payment = await prisma.subscriptionPayment.findUnique({ where: { id: body.paymentId } });
      if (!payment || payment.userId !== req.user!.id) {
        return res.status(404).json({ error: "Payment not found" });
      }
      const result = await fulfillSubscriptionPayment(payment.id);
      res.json({
        ok: true,
        alreadyPaid: result.alreadyPaid,
        trial: buildTrialStatus(result.user),
        periodEnd: result.user.subscriptionPeriodEnd?.toISOString() ?? null,
        redirectUrl: `${config.webAppUrl}/profile/billing/subscriptions?paid=1`,
      });
    } catch (e) {
      next(e);
    }
  }
);

subscriptionRouter.post("/payhere/notify", async (req, res, next) => {
  try {
    const orderId = String(req.body.order_id || req.body.orderId || "");
    const statusCode = String(req.body.status_code || "");
    const md5sig = String(req.body.md5sig || "").toUpperCase();

    if (!orderId) return res.status(400).send("missing order_id");

    if (payHereConfigured() && md5sig) {
      const amount = String(req.body.payhere_amount || "");
      const currency = String(req.body.payhere_currency || "LKR");
      const secretHash = createHash("md5")
        .update(config.payhere.merchantSecret)
        .digest("hex")
        .toUpperCase();
      const local = createHash("md5")
        .update(
          config.payhere.merchantId +
            orderId +
            amount +
            currency +
            statusCode +
            secretHash
        )
        .digest("hex")
        .toUpperCase();
      if (local !== md5sig) {
        return res.status(400).send("invalid signature");
      }
    }

    if (statusCode === "2" || statusCode === "0" || !payHereConfigured()) {
      await fulfillSubscriptionPayment(orderId);
    } else {
      await prisma.subscriptionPayment.updateMany({
        where: { id: orderId, status: "PENDING" },
        data: { status: "FAILED" },
      });
    }

    res.send("OK");
  } catch (e) {
    next(e);
  }
});
