import { Router } from "express";
import { DEFAULT_TOUR_COVER_URL, resolveImageUrl } from "@tourpilot/shared";
import { prisma } from "../lib/prisma.js";
import { parseInfluencerDisplay } from "../lib/influencerDisplay.js";
import { attachTourPricing } from "../lib/tourPricing.js";

export const influencersRouter = Router();

influencersRouter.get("/:slug", async (req, res, next) => {
  try {
    const profile = await prisma.influencerProfile.findFirst({
      where: { slug: req.params.slug },
      include: {
        user: { select: { name: true } },
        codes: {
          where: { isActive: true, tourId: { not: null } },
          select: { code: true, tourId: true },
        },
      },
    });

    if (!profile) return res.status(404).json({ error: "Influencer not found" });

    const display = parseInfluencerDisplay(profile.display, profile.user.name);
    const tourIds = display.tourIds;

    const tours =
      tourIds.length === 0
        ? []
        : await prisma.tour.findMany({
            where: {
              id: { in: tourIds },
              isPublished: true,
              tourKind: "READY_MADE",
            },
            include: {
              agency: { select: { id: true, name: true, slug: true, influencerCommissionPct: true } },
            },
          });

    const order = new Map(tourIds.map((id, i) => [id, i]));
    tours.sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));

    const codeByTourId = new Map(
      profile.codes
        .filter((c): c is typeof c & { tourId: string } => Boolean(c.tourId))
        .map((c) => [c.tourId, c.code])
    );

    res.json({
      slug: profile.slug,
      name: profile.user.name,
      bio: profile.bio,
      headline: display.headline,
      tagline: display.tagline,
      tours: tours.map((t) => {
        const pricing = attachTourPricing(t);
        const refCode = codeByTourId.get(t.id);
        return {
          id: t.id,
          title: t.title,
          slug: t.slug,
          summary: t.summary,
          days: t.days,
          publicPriceLkr: pricing.publicPriceLkr,
          coverUrl: resolveImageUrl(t.coverUrl, DEFAULT_TOUR_COVER_URL),
          agency: t.agency,
          refCode: refCode ?? null,
          tourPath: `/tours/${t.agency.slug}/${t.slug}${refCode ? `?ref=${refCode}` : ""}`,
        };
      }),
    });
  } catch (e) {
    next(e);
  }
});
