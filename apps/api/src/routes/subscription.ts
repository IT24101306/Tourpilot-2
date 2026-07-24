import { Router } from "express";
import { z } from "zod";
import {
  DEFAULT_PRICING_PAGE,
  parsePricingPageContent,
  type PricingPageContent,
} from "@tourpilot/shared";
import { prisma } from "../lib/prisma.js";
import { authRequired, requireRoles } from "../middleware/auth.js";
import { config } from "../lib/config.js";
import { payHereCheckoutUrl, payHereConfigured } from "../lib/payhere.js";
import {
  buildTrialStatus,
  parseSelectedPackage,
  trialUserUpdateData,
} from "../services/trial.js";

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

      // Payment gateway not live yet — do not auto-activate or start PayHere/demo checkout.
      return res.status(503).json({
        error:
          "Online payments are not available yet. Please contact the system administrator to activate your package.",
        mode: "manual_contact",
        contact: {
          company: "IYYO Solutions",
          email: "info@iyyosolutions.com",
          phone: "+94719990173",
          whatsapp: "+94720140224",
          website: "https://iyyosolutions.com",
        },
        redirectUrl: `${config.webAppUrl}/profile/billing/subscriptions/checkout`,
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
  async (_req, res) => {
    res.status(503).json({
      error:
        "Online payments are not available yet. Please contact the system administrator to activate your package.",
      mode: "manual_contact",
    });
  }
);

subscriptionRouter.post("/payhere/notify", async (_req, res) => {
  // Payment gateway not live — ignore notifications so packages are not auto-activated.
  res.status(503).send("payments_unavailable");
});
