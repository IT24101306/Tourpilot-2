import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authRequired, getAgencyForUser, requireRoles } from "../middleware/auth.js";
import { recalculateAgencyRatings } from "../services/agencyRatings.js";

export const reviewsRouter = Router();

/** Tourist submits a review for a completed trip. */
reviewsRouter.post(
  "/trip/:inquiryId",
  authRequired,
  requireRoles("TOURIST"),
  async (req, res, next) => {
    try {
      const { rating, body } = z
        .object({
          rating: z.number().int().min(1).max(5),
          body: z.string().max(2000).optional(),
        })
        .parse(req.body);

      const inquiry = await prisma.inquiry.findFirst({
        where: { id: req.params.inquiryId, touristId: req.user!.id },
      });
      if (!inquiry) return res.status(404).json({ error: "Inquiry not found" });
      if (inquiry.status !== "COMPLETED") {
        return res.status(400).json({ error: "You can only review completed trips." });
      }

      const existing = await prisma.touristReview.findUnique({
        where: { inquiryId: inquiry.id },
      });
      if (existing) {
        return res.status(409).json({ error: "You have already reviewed this trip." });
      }

      const review = await prisma.touristReview.create({
        data: {
          inquiryId: inquiry.id,
          touristId: req.user!.id,
          agencyId: inquiry.agencyId,
          rating,
          body: body?.trim() || null,
        },
      });

      // Not public by default — rating updates when agency publishes.
      res.status(201).json(review);
    } catch (e) {
      next(e);
    }
  }
);

/** Tourist lists their own submitted reviews. */
reviewsRouter.get("/mine", authRequired, requireRoles("TOURIST"), async (req, res, next) => {
  try {
    const reviews = await prisma.touristReview.findMany({
      where: { touristId: req.user!.id },
      orderBy: { createdAt: "desc" },
      include: {
        inquiry: {
          select: { id: true, tour: { select: { title: true } } },
        },
        agency: { select: { id: true, name: true, slug: true } },
      },
    });
    res.json(reviews);
  } catch (e) {
    next(e);
  }
});

/** Agency lists all tourist reviews for their agency. */
reviewsRouter.get(
  "/agency/mine",
  authRequired,
  requireRoles("AGENCY"),
  async (req, res, next) => {
    try {
      const agency = await getAgencyForUser(req.user!.id);
      if (!agency) return res.status(404).json({ error: "Agency not found" });

      const reviews = await prisma.touristReview.findMany({
        where: { agencyId: agency.id },
        orderBy: { createdAt: "desc" },
        include: {
          tourist: { select: { id: true, name: true } },
          inquiry: {
            select: {
              id: true,
              tour: { select: { id: true, title: true } },
            },
          },
        },
      });
      res.json(reviews);
    } catch (e) {
      next(e);
    }
  }
);

/** Agency toggles a tourist review's public visibility. */
reviewsRouter.patch(
  "/agency/mine/:id/visibility",
  authRequired,
  requireRoles("AGENCY"),
  async (req, res, next) => {
    try {
      const { isPublic } = z
        .object({ isPublic: z.boolean() })
        .parse(req.body);

      const agency = await getAgencyForUser(req.user!.id);
      if (!agency) return res.status(404).json({ error: "Agency not found" });

      const review = await prisma.touristReview.findFirst({
        where: { id: req.params.id, agencyId: agency.id },
      });
      if (!review) return res.status(404).json({ error: "Review not found" });

      const updated = await prisma.touristReview.update({
        where: { id: review.id },
        data: { isPublic },
      });

      await recalculateAgencyRatings(agency.id);

      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);
