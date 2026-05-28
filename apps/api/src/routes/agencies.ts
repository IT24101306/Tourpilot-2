import { Router } from "express";

import { z } from "zod";

import { prisma } from "../lib/prisma.js";

import { authRequired, getAgencyForUser, requireRoles } from "../middleware/auth.js";

import { asJson } from "../utils/json.js";

import {

  buildSectionsPayload,

  parseDisplayPayload,

  parseGallery,

  type DisplayPackage,

} from "../lib/displaySettings.js";



export const agenciesRouter = Router();



const galleryItemSchema = z.object({

  url: z.string().min(1),

  label: z.string().default("Gallery"),

});



const packageSchema = z.object({

  title: z.string().min(1),

  location: z.string().default(""),

  priceLabel: z.string().default(""),

  imageUrl: z.string().min(1),

  tourId: z.string().optional(),

});



const offerSchema = z.object({

  title: z.string().min(1),

  description: z.string().default(""),

  priceLabel: z.string().default(""),

  badge: z.string().optional(),

  imageUrl: z.string().optional(),

});



const contentSchema = z.object({

  heroHeadline: z.string(),

  packagesTitle: z.string(),

  packagesSubtitle: z.string(),

  ratingScore: z.string(),

  ratingSuffix: z.string(),

  highlights: z.array(z.string()).max(6),

  ctaLabel: z.string(),

  featuredImageUrl: z.string(),

  featuredQuote: z.string(),

  packages: z.array(packageSchema).default([]),

  offers: z.array(offerSchema).default([]),

});



const enabledSchema = z.object({

  tours: z.boolean(),

  showcase: z.boolean(),

  reviews: z.boolean(),

  gallery: z.boolean(),

  offers: z.boolean(),

  inquiry: z.boolean(),

});



agenciesRouter.get("/", async (_req, res, next) => {

  try {

    const agencies = await prisma.agency.findMany({

      where: { status: "APPROVED" },

      orderBy: { avgRating: "desc" },

      select: {

        id: true,

        name: true,

        slug: true,

        tagline: true,

        logoUrl: true,

        coverUrl: true,

        district: true,

        avgRating: true,

        reviewCount: true,

        _count: { select: { tours: { where: { isPublished: true } } } },

      },

    });

    res.json(

      agencies.map((a) => ({

        ...a,

        avgRating: Number(a.avgRating),

        tourCount: a._count.tours,

      }))

    );

  } catch (e) {

    next(e);

  }

});



agenciesRouter.patch("/mine", authRequired, requireRoles("AGENCY"), async (req, res, next) => {

  try {

    const agency = await getAgencyForUser(req.user!.id);

    if (!agency) return res.status(404).json({ error: "Agency not found" });



    const body = z

      .object({

        name: z.string().optional(),

        tagline: z.string().optional(),

        description: z.string().optional(),

        logoUrl: z.string().optional(),

        coverUrl: z.string().optional(),

        district: z.string().optional(),

        contactPhone: z.string().optional(),

        contactEmail: z.string().email().optional(),

        gallery: z.array(z.unknown()).optional(),

        pageConfig: z.record(z.unknown()).optional(),

      })

      .parse(req.body);



    const updated = await prisma.agency.update({

      where: { id: agency.id },

      data: {

        ...body,

        pageConfig: body.pageConfig ? asJson(body.pageConfig) : undefined,

        gallery: body.gallery ? asJson(body.gallery) : undefined,

      },

    });



    res.json(updated);

  } catch (e) {

    next(e);

  }

});



agenciesRouter.get("/mine/display", authRequired, requireRoles("AGENCY"), async (req, res, next) => {

  try {

    const agency = await getAgencyForUser(req.user!.id);

    if (!agency) return res.status(404).json({ error: "Agency not found" });



    const full = await prisma.agency.findUniqueOrThrow({

      where: { id: agency.id },

      include: {

        displaySettings: true,

        reviews: { where: { isVisible: true }, orderBy: { createdAt: "desc" } },

        tours: {

          where: { isPublished: true },

          select: {

            id: true,

            title: true,

            slug: true,

            days: true,

            summary: true,

            basePriceLkr: true,

            coverUrl: true,

            districtTags: true,

          },

        },

      },

    });



    const display = parseDisplayPayload(full.displaySettings?.sections);



    res.json({

      slug: full.slug,

      enabled: display.enabled,

      content: display.content,

      gallery: parseGallery(full.gallery),

      reviews: full.reviews.map((r) => ({

        id: r.id,

        authorName: r.authorName,

        rating: r.rating,

        body: r.body || "",

      })),

      publishedTours: full.tours.map((t) => ({

        id: t.id,

        title: t.title,

        slug: t.slug,

        days: t.days,

        summary: t.summary,

        basePriceLkr: Number(t.basePriceLkr),

        coverUrl: t.coverUrl,

        districtTags: t.districtTags,

      })),

    });

  } catch (e) {

    next(e);

  }

});



agenciesRouter.put("/mine/display", authRequired, requireRoles("AGENCY"), async (req, res, next) => {

  try {

    const agency = await getAgencyForUser(req.user!.id);

    if (!agency) return res.status(404).json({ error: "Agency not found" });



    const body = z

      .object({

        enabled: enabledSchema,

        content: contentSchema,

        gallery: z.array(galleryItemSchema).default([]),

        reviews: z

          .array(

            z.object({

              authorName: z.string().min(1),

              rating: z.number().int().min(1).max(5),

              body: z.string().optional(),

            })

          )

          .default([]),

      })

      .parse(req.body);



    const galleryItems = body.gallery

      .map((g) => ({ url: g.url.trim(), label: g.label.trim() || "Gallery" }))

      .filter((g) => g.url);



    await prisma.$transaction(async (tx) => {

      await tx.displaySettings.upsert({

        where: { agencyId: agency.id },

        create: {

          agencyId: agency.id,

          sections: asJson(buildSectionsPayload(body.enabled, body.content)),

          theme: asJson({}),

        },

        update: {

          sections: asJson(buildSectionsPayload(body.enabled, body.content)),

        },

      });



      await tx.agency.update({

        where: { id: agency.id },

        data: { gallery: asJson(galleryItems) },

      });



      await tx.review.deleteMany({ where: { agencyId: agency.id } });

      if (body.reviews.length > 0) {

        await tx.review.createMany({

          data: body.reviews.map((r) => ({

            agencyId: agency.id,

            authorName: r.authorName.trim(),

            rating: r.rating,

            body: r.body?.trim() || null,

            isVisible: true,

          })),

        });

      }



      const count = body.reviews.length;

      const avg =

        count > 0 ? body.reviews.reduce((sum, r) => sum + r.rating, 0) / count : 0;

      await tx.agency.update({

        where: { id: agency.id },

        data: { reviewCount: count, avgRating: count > 0 ? avg : 0 },

      });

    });



    const updated = await prisma.agency.findUniqueOrThrow({

      where: { id: agency.id },

      include: { reviews: { where: { isVisible: true }, orderBy: { createdAt: "desc" } } },

    });



    res.json({

      slug: updated.slug,

      enabled: body.enabled,

      content: body.content,

      gallery: galleryItems,

      reviews: updated.reviews.map((r) => ({

        id: r.id,

        authorName: r.authorName,

        rating: r.rating,

        body: r.body || "",

      })),

    });

  } catch (e) {

    next(e);

  }

});



agenciesRouter.get("/:slug", async (req, res, next) => {

  try {

    const agency = await prisma.agency.findFirst({

      where: { slug: req.params.slug, status: "APPROVED" },

      include: {

        tours: {

          where: { isPublished: true },

          orderBy: { createdAt: "desc" },

        },

        reviews: { where: { isVisible: true }, orderBy: { createdAt: "desc" }, take: 20 },

        displaySettings: true,

      },

    });



    if (!agency) return res.status(404).json({ error: "Agency not found" });



    const display = parseDisplayPayload(agency.displaySettings?.sections);

    const gallery = parseGallery(agency.gallery);

    const packages = resolvePackages(display.content.packages, agency.tours);



    res.json({

      id: agency.id,

      name: agency.name,

      slug: agency.slug,

      tagline: agency.tagline,

      description: agency.description,

      logoUrl: agency.logoUrl,

      coverUrl: agency.coverUrl,

      district: agency.district,

      avgRating: Number(agency.avgRating),

      reviewCount: agency.reviewCount,

      tours: agency.tours.map(serializeTourCard),

      reviews: agency.reviews,

      display: { enabled: display.enabled, content: { ...display.content, packages } },

      gallery,

    });

  } catch (e) {

    next(e);

  }

});



const DEFAULT_PACKAGE_IMAGE =
  "https://images.unsplash.com/photo-1580619305218-8423a4bb63b2?auto=format&fit=crop&w=1200&q=80";

function resolvePackages(
  custom: DisplayPackage[],
  tours: {
    id: string;
    title: string;
    slug: string;
    summary: string | null;
    days: number;
    basePriceLkr: unknown;
    coverUrl: string | null;
    districtTags: unknown;
  }[]
): DisplayPackage[] {
  const tourById = new Map(tours.map((t) => [t.id, t]));

  if (custom.length > 0) {
    return custom.map((p) => {
      const tour = p.tourId ? tourById.get(p.tourId) : undefined;
      return {
        ...p,
        imageUrl: p.imageUrl?.trim() || tour?.coverUrl || DEFAULT_PACKAGE_IMAGE,
        tourId: p.tourId || tour?.id,
      };
    });
  }

  return tours.map((t) => {
    const districts = Array.isArray(t.districtTags)
      ? (t.districtTags as string[]).filter(Boolean)
      : [];
    return {
      title: t.title,
      location: districts[0] || `${t.days} day tour`,
      priceLabel: `LKR ${Number(t.basePriceLkr).toLocaleString()} / per person`,
      imageUrl: t.coverUrl || DEFAULT_PACKAGE_IMAGE,
      tourId: t.id,
    };
  });
}



export function serializeTourCard(tour: {

  id: string;

  title: string;

  slug: string;

  summary: string | null;

  days: number;

  basePriceLkr: unknown;

  coverUrl: string | null;

  seasonTag: string | null;

  districtTags: unknown;

}) {

  return {

    id: tour.id,

    title: tour.title,

    slug: tour.slug,

    summary: tour.summary,

    days: tour.days,

    basePriceLkr: Number(tour.basePriceLkr),

    coverUrl: tour.coverUrl,

    seasonTag: tour.seasonTag,

    districtTags: tour.districtTags,

  };

}


