import { Router } from "express";
import { z } from "zod";
import { authRequired, getAgencyForUser, requireRoles } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { buildInquiryAssist } from "../services/aiAssist.js";
import { loadAgencyTrustBadges } from "../services/trustBadges.js";
import { generateTripPlan } from "../services/tripPlanner.js";
import { generateChatbotReply } from "../services/chatbot.js";
import { buildMarginCoachTips } from "@tourpilot/shared";

export const smartRouter = Router();

const tripPlannerBodySchema = z.object({
  days: z.number().int().min(1).max(30),
  pax: z.number().int().min(1).max(50).default(2),
  interests: z.array(z.string().min(1).max(80)).max(20).default([]),
  budgetMinLkr: z.number().min(0).nullable().optional(),
  budgetMaxLkr: z.number().min(0).nullable().optional(),
  startDate: z.string().max(32).nullable().optional(),
  pace: z.enum(["relaxed", "balanced", "packed"]).optional(),
  notes: z.string().max(2000).nullable().optional(),
});

/** Public: AI trip planner. Requires OPENAI_API_KEY — no stub replies. */
smartRouter.post("/trip-planner", async (req, res, next) => {
  try {
    const body = tripPlannerBodySchema.parse(req.body);
    if (
      body.budgetMinLkr != null &&
      body.budgetMaxLkr != null &&
      body.budgetMinLkr > body.budgetMaxLkr
    ) {
      return res.status(400).json({ error: "budgetMinLkr cannot exceed budgetMaxLkr" });
    }
    const plan = await generateTripPlan(body);
    res.json(plan);
  } catch (e) {
    next(e);
  }
});

const chatbotBodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      })
    )
    .min(1)
    .max(24),
  pagePath: z.string().max(200).nullable().optional(),
});

/** Public: AI chatbot. Requires OPENAI_API_KEY — no stub replies. */
smartRouter.post("/chatbot", async (req, res, next) => {
  try {
    const body = chatbotBodySchema.parse(req.body);
    const last = body.messages[body.messages.length - 1];
    if (!last || last.role !== "user") {
      return res.status(400).json({ error: "Last message must be from the user" });
    }
    const result = await generateChatbotReply({
      messages: body.messages,
      pagePath: body.pagePath ?? null,
    });
    res.json(result);
  } catch (e) {
    next(e);
  }
});

smartRouter.get(
  "/inquiries/:id/assist",
  authRequired,
  requireRoles("AGENCY", "TOURIST", "INFLUENCER", "ADMIN"),
  async (req, res, next) => {
    try {
      const role = req.user!.role === "ADMIN" ? "AGENCY" : req.user!.role;
      if (role !== "AGENCY" && role !== "TOURIST" && role !== "INFLUENCER") {
        return res.status(403).json({ error: "Forbidden" });
      }

      const inquiry = await prisma.inquiry.findUnique({
        where: { id: req.params.id },
        select: {
          id: true,
          touristId: true,
          agencyId: true,
          handlerInfluencerId: true,
        },
      });
      if (!inquiry) return res.status(404).json({ error: "Inquiry not found" });

      if (req.user!.role === "TOURIST" && inquiry.touristId !== req.user!.id) {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (req.user!.role === "AGENCY") {
        const agency = await getAgencyForUser(req.user!.id);
        if (!agency || agency.id !== inquiry.agencyId) {
          return res.status(403).json({ error: "Forbidden" });
        }
      }
      if (req.user!.role === "INFLUENCER") {
        const profile = await prisma.influencerProfile.findUnique({
          where: { userId: req.user!.id },
          select: { id: true },
        });
        if (!profile || profile.id !== inquiry.handlerInfluencerId) {
          return res.status(403).json({ error: "Forbidden" });
        }
      }

      const assist = await buildInquiryAssist(
        inquiry.id,
        role as "AGENCY" | "TOURIST" | "INFLUENCER"
      );
      if (!assist) return res.status(404).json({ error: "Inquiry not found" });
      res.json(assist);
    } catch (e) {
      next(e);
    }
  }
);

smartRouter.post("/margin-coach", authRequired, requireRoles("AGENCY"), async (req, res, next) => {
  try {
    const body = z
      .object({
        costLkr: z.number(),
        sellingLkr: z.number(),
        commissionLkr: z.number().optional(),
        listedPriceLkr: z.number().optional(),
        onRequestCount: z.number().optional(),
        targetMarginPct: z.number().optional(),
        warnBelowPct: z.number().optional(),
      })
      .parse(req.body);

    const agency = await getAgencyForUser(req.user!.id);
    const prefs =
      agency?.pricingPrefs && typeof agency.pricingPrefs === "object" && !Array.isArray(agency.pricingPrefs)
        ? (agency.pricingPrefs as Record<string, unknown>)
        : {};

    const tips = buildMarginCoachTips({
      ...body,
      targetMarginPct:
        body.targetMarginPct ??
        (typeof prefs.targetMarginPct === "number" ? prefs.targetMarginPct : undefined),
      warnBelowPct:
        body.warnBelowPct ??
        (typeof prefs.warnBelowPct === "number" ? prefs.warnBelowPct : undefined),
    });

    res.json({ tips });
  } catch (e) {
    next(e);
  }
});

smartRouter.get(
  "/agencies/mine/trust-badges",
  authRequired,
  requireRoles("AGENCY"),
  async (req, res, next) => {
    try {
      const agency = await getAgencyForUser(req.user!.id);
      if (!agency) return res.status(404).json({ error: "Agency not found" });
      const result = await loadAgencyTrustBadges(agency.id);
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

smartRouter.patch(
  "/agencies/mine/pricing-prefs",
  authRequired,
  requireRoles("AGENCY"),
  async (req, res, next) => {
    try {
      const body = z
        .object({
          targetMarginPct: z.number().min(0).max(90).optional(),
          warnBelowPct: z.number().min(0).max(90).optional(),
        })
        .parse(req.body);
      const agency = await getAgencyForUser(req.user!.id);
      if (!agency) return res.status(404).json({ error: "Agency not found" });

      const prev =
        agency.pricingPrefs && typeof agency.pricingPrefs === "object" && !Array.isArray(agency.pricingPrefs)
          ? (agency.pricingPrefs as Record<string, unknown>)
          : {};

      const pricingPrefs = {
        ...prev,
        ...(body.targetMarginPct != null ? { targetMarginPct: body.targetMarginPct } : {}),
        ...(body.warnBelowPct != null ? { warnBelowPct: body.warnBelowPct } : {}),
      };

      const updated = await prisma.agency.update({
        where: { id: agency.id },
        data: { pricingPrefs },
        select: { pricingPrefs: true },
      });
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);
