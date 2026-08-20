import { Router } from "express";
import { z } from "zod";
import {
  DEFAULT_PRICING_PAGE,
  parsePricingPageContent,
  type PricingPageContent,
} from "@tourpilot/shared";
import { prisma } from "../lib/prisma.js";
import { authRequired, getAgencyForUser, requireRoles } from "../middleware/auth.js";
import { config } from "../lib/config.js";
import {
  payHereCheckoutUrl,
  payHereConfigured,
  payHereCustomerFromUser,
  payHereNotConfiguredError,
  requirePayHereCheckoutFields,
  verifyPayHereNotify,
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

const BILLING_ROLES = ["AGENCY", "INFLUENCER", "DRIVER"] as const;

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

subscriptionRouter.get("/", authRequired, requireRoles(...BILLING_ROLES), async (req, res, next) => {
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
    requireRoles(...BILLING_ROLES),
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
    requireRoles(...BILLING_ROLES),
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
    requireRoles(...BILLING_ROLES),
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

export async function startPackageCheckout(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.selectedPackageId || !user.selectedPackageName) {
    const err = new Error("No package selected for this account");
    (err as Error & { status: number }).status = 400;
    throw err;
  }

  const amount = Math.round(Number(user.selectedPackagePriceLkr ?? 0));
  const billing = (user.selectedPackageBilling || "MONTHLY").toUpperCase();

  if (billing === "PAYG" || amount <= 0) {
    const result = await activateSelectedPackage(user.id);
    return {
      mode: "activated" as const,
      trial: result.trial,
      redirectUrl: `${config.webAppUrl}/profile/billing/subscriptions`,
    };
  }

  if (!payHereConfigured()) throw payHereNotConfiguredError();

  const agency = user.role === "AGENCY" ? await getAgencyForUser(user.id) : null;
  const payment = await prisma.subscriptionPayment.create({
    data: {
      userId: user.id,
      agencyId: agency?.id ?? null,
      packageId: user.selectedPackageId,
      packageName: user.selectedPackageName,
      amountLkr: amount,
      currency: "LKR",
      status: "PENDING",
      provider: "payhere",
    },
  });

  const fields = requirePayHereCheckoutFields({
    orderId: payment.id,
    amountLkr: amount,
    itemTitle: `${user.selectedPackageName} — TourPilot`,
    returnUrl: `${config.webAppUrl}/profile/billing/subscriptions/return`,
    cancelUrl: `${config.webAppUrl}/profile/billing/subscriptions/cancel`,
    notifyUrl: `${config.webAppUrl}/api/subscription/payhere/notify`,
    customer: payHereCustomerFromUser(user),
  });

  await prisma.subscriptionPayment.update({
    where: { id: payment.id },
    data: {
      checkoutUrl: payHereCheckoutUrl(),
      payhereOrderId: payment.id,
      metadata: asJson({ fields }),
    },
  });

  return {
    mode: "payhere" as const,
    paymentId: payment.id,
    checkoutUrl: payHereCheckoutUrl(),
    fields,
    redirectUrl: `${config.webAppUrl}/profile/billing/subscriptions/checkout?payment=${payment.id}`,
  };
}

subscriptionRouter.post(
  "/checkout",
  authRequired,
  requireRoles(...BILLING_ROLES),
  async (req, res, next) => {
    try {
      res.json(await startPackageCheckout(req.user!.id));
    } catch (e) {
      next(e);
    }
  }
);

subscriptionRouter.get(
  "/checkout-session",
  authRequired,
    requireRoles(...BILLING_ROLES),
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
        mode: "payhere",
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
  requireRoles(...BILLING_ROLES),
  async (_req, res) => {
    res.status(400).json({
      error: "Demo checkout is disabled. Complete payment with PayHere.",
      code: "PAYHERE_REQUIRED",
    });
  }
);

subscriptionRouter.post("/payhere/notify", async (req, res, next) => {
  try {
    const body = (req.body || {}) as Record<string, unknown>;
    const verified = verifyPayHereNotify(body);
    if (!verified.ok || !verified.orderId) {
      return res.status(403).send("invalid_signature");
    }

    const payment = await prisma.subscriptionPayment.findUnique({
      where: { id: verified.orderId },
    });
    if (!payment) return res.status(404).send("unknown order");

    if (verified.statusCode === "2") {
      await fulfillSubscriptionPayment(payment.id, {
        providerRef: verified.providerPaymentId,
        metadata: body,
      });
    } else if (verified.statusCode === "0" || verified.statusCode === "-1" || verified.statusCode === "-2") {
      await prisma.subscriptionPayment.update({
        where: { id: payment.id },
        data: {
          status: verified.statusCode === "0" ? "PENDING" : "FAILED",
          metadata: asJson(body),
        },
      });
    }

    res.status(200).send("OK");
  } catch (e) {
    next(e);
  }
});
