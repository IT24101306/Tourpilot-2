import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import type { AgencyStatus, CommissionStatus, InquiryStatus, Prisma, UserRole } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { authRequired, requireRoles } from "../../middleware/auth.js";
import { asJson } from "../../utils/json.js";
import {
  agencyRejectionEmail,
  finalizeEmailTemplate,
  sendPlatformEmail,
} from "../../services/email.js";
import { InquiryMessageKind } from "@prisma/client";
import { createInquiryMessage, serializeInquiryMessage } from "../../services/inquiryMessages.js";
import {
  notifyAdminInquiryMessage,
  notifyCommissionPaid,
} from "../../services/notifications.js";
import { creditCommissionPayout } from "../../services/wallet.js";
import {
  agencyFeatureDbFields,
  serializeAgencyFeatures,
  type AgencyFeatures,
} from "../../lib/agencyFeatures.js";
import {
  getPlatformSettings,
  resolveLoginFeeForUser,
  updatePlatformSettings,
} from "../../services/platformSettings.js";

export const adminRouter = Router();

adminRouter.use(authRequired, requireRoles("ADMIN"));

const inquiryStatusSchema = z.enum([
  "NEW",
  "AGENCY_REVIEWING",
  "ITINERARY_DRAFT",
  "SENT_TO_TOURIST",
  "TOURIST_VIEWED",
  "REVISION_REQUESTED",
  "ACCEPTED",
  "DECLINED",
  "EXPIRED",
]);

const commissionStatusSchema = z.enum(["PENDING", "APPROVED", "PAID", "CANCELLED"]);

const loginFeesSchema = z.object({
  TOURIST: z.number().min(0).optional(),
  AGENCY: z.number().min(0).optional(),
  INFLUENCER: z.number().min(0).optional(),
  DRIVER: z.number().min(0).optional(),
  ADMIN: z.number().min(0).optional(),
});

adminRouter.get("/settings", async (_req, res, next) => {
  try {
    res.json(await getPlatformSettings());
  } catch (e) {
    next(e);
  }
});

adminRouter.put("/settings", async (req, res, next) => {
  try {
    const body = z
      .object({
        loginFees: loginFeesSchema.optional(),
        inquiryExpiryDays: z.number().int().min(1).max(365).optional(),
        webAppUrl: z.string().max(255).nullable().optional(),
        emailFrom: z.string().max(255).nullable().optional(),
        walletTopupMinLkr: z.number().int().min(1).optional(),
        walletTopupMaxLkr: z.number().int().min(1).nullable().optional(),
        emailTemplates: z
          .record(
            z.string(),
            z.object({
              subject: z.string().max(200).optional(),
              body: z.string().max(8000).optional(),
            })
          )
          .optional(),
      })
      .parse(req.body);
    res.json(await updatePlatformSettings(body));
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/stats", async (_req, res, next) => {
  try {
    const [
      usersByRole,
      agenciesByStatus,
      inquiryGroups,
      commissionGroups,
      offerCount,
      activeOffers,
      ledgerAgg,
      pendingAgencies,
    ] = await Promise.all([
      prisma.user.groupBy({ by: ["role"], _count: { id: true } }),
      prisma.agency.groupBy({ by: ["status"], _count: { id: true } }),
      prisma.inquiry.groupBy({ by: ["status"], _count: { id: true } }),
      prisma.commission.groupBy({ by: ["status"], _count: { id: true } }),
      prisma.offer.count(),
      prisma.offer.count({ where: { isActive: true } }),
      prisma.walletLedger.aggregate({ _sum: { amountLkr: true } }),
      prisma.agency.count({ where: { status: "PENDING" } }),
    ]);

    const users: Record<string, number> = {};
    for (const row of usersByRole) users[row.role] = row._count.id;

    const agencies: Record<string, number> = {};
    for (const row of agenciesByStatus) agencies[row.status] = row._count.id;

    const inquiries: Record<string, number> = {};
    for (const row of inquiryGroups) inquiries[row.status] = row._count.id;

    const commissions: Record<string, number> = {};
    for (const row of commissionGroups) commissions[row.status] = row._count.id;

    res.json({
      users,
      agencies,
      inquiries,
      commissions,
      offers: { total: offerCount, active: activeOffers },
      ledgerVolumeLkr: Number(ledgerAgg._sum.amountLkr ?? 0),
      pendingAgencies,
    });
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/agencies", async (req, res, next) => {
  try {
    const status = req.query.status as AgencyStatus | undefined;
    const where: Prisma.AgencyWhereInput = status ? { status } : {};
    const agencies = await prisma.agency.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        owner: { select: { id: true, name: true, phone: true, email: true } },
        _count: { select: { tours: true, inquiries: true, reviews: true } },
      },
    });
    res.json(
      agencies.map((a) => ({
        id: a.id,
        name: a.name,
        slug: a.slug,
        status: a.status,
        district: a.district,
        contactEmail: a.contactEmail,
        rejectionReason: a.rejectionReason,
        rejectedAt: a.rejectedAt,
        avgRating: Number(a.avgRating),
        reviewCount: a.reviewCount,
        owner: a.owner,
        tourCount: a._count.tours,
        inquiryCount: a._count.inquiries,
        kyc: a.kyc,
        kycSubmittedAt: a.kycSubmittedAt,
        createdAt: a.createdAt,
        features: serializeAgencyFeatures(a),
      }))
    );
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/agencies/pending", async (_req, res, next) => {
  try {
    const agencies = await prisma.agency.findMany({
      where: { status: "PENDING" },
      include: { owner: { select: { name: true, phone: true, email: true } } },
    });
    res.json(agencies);
  } catch (e) {
    next(e);
  }
});

adminRouter.patch("/agencies/:id/approve", async (req, res, next) => {
  try {
    const agency = await prisma.agency.update({
      where: { id: req.params.id },
      data: {
        status: "APPROVED",
        rejectionReason: null,
        rejectedAt: null,
      },
    });
    res.json(agency);
  } catch (e) {
    next(e);
  }
});

adminRouter.patch("/agencies/:id/reject", async (req, res, next) => {
  try {
    const body = z
      .object({
        reason: z.string().min(3).max(2000),
        sendEmail: z.boolean().optional().default(true),
      })
      .parse(req.body);

    const existing = await prisma.agency.findUniqueOrThrow({
      where: { id: req.params.id },
      include: { owner: { select: { name: true, email: true } } },
    });

    const agency = await prisma.agency.update({
      where: { id: req.params.id },
      data: {
        status: "REJECTED",
        rejectionReason: body.reason.trim(),
        rejectedAt: new Date(),
      },
    });

    let emailResult = null;
    if (body.sendEmail) {
      const to = existing.contactEmail?.trim() || existing.owner.email?.trim() || "";
      if (to) {
        const template = await finalizeEmailTemplate(
          "agencyRejection",
          agencyRejectionEmail({
            agencyName: existing.name,
            ownerName: existing.owner.name,
            reason: body.reason.trim(),
          }),
          {
            agencyName: existing.name,
            ownerName: existing.owner.name,
            reason: body.reason.trim(),
          }
        );
        emailResult = await sendPlatformEmail({ to, ...template });
      } else {
        emailResult = { delivered: false, mode: "log" as const, error: "No email on file" };
      }
    }

    res.json({ agency, emailResult });
  } catch (e) {
    next(e);
  }
});

adminRouter.patch("/agencies/:id/status", async (req, res, next) => {
  try {
    const body = z
      .object({
        status: z.enum(["PENDING", "APPROVED", "SUSPENDED", "REJECTED"]),
        reason: z.string().optional(),
      })
      .parse(req.body);

    const data: Prisma.AgencyUpdateInput = { status: body.status };
    if (body.status === "REJECTED" && body.reason) {
      data.rejectionReason = body.reason;
      data.rejectedAt = new Date();
    }
    if (body.status === "APPROVED") {
      data.rejectionReason = null;
      data.rejectedAt = null;
    }

    const agency = await prisma.agency.update({ where: { id: req.params.id }, data });
    res.json(agency);
  } catch (e) {
    next(e);
  }
});

adminRouter.patch("/agencies/:id/features", async (req, res, next) => {
  try {
    const body = z
      .object({
        driversAndPartners: z.boolean().optional(),
        support: z.boolean().optional(),
        walletTopup: z.boolean().optional(),
        offers: z.boolean().optional(),
        display: z.boolean().optional(),
        readyMadeTours: z.boolean().optional(),
        customInquiries: z.boolean().optional(),
        negotiationsBookings: z.boolean().optional(),
        customDomain: z.boolean().optional(),
      })
      .refine((v) => Object.keys(v).length > 0, { message: "At least one feature flag is required" })
      .parse(req.body) as Partial<AgencyFeatures>;

    const agency = await prisma.agency.update({
      where: { id: req.params.id },
      data: agencyFeatureDbFields(body),
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        featureDriversAndPartners: true,
        featureSupport: true,
        featureWalletTopup: true,
        featureOffers: true,
        featureDisplay: true,
        featureReadyMadeTours: true,
        featureCustomInquiries: true,
        featureNegotiationsBookings: true,
        featureCustomDomain: true,
      },
    });

    res.json({
      id: agency.id,
      name: agency.name,
      slug: agency.slug,
      status: agency.status,
      features: serializeAgencyFeatures(agency),
    });
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/users", async (req, res, next) => {
  try {
    const role = req.query.role as UserRole | undefined;
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const where: Prisma.UserWhereInput = {};
    if (role) where.role = role;
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { phone: { contains: q } },
        { email: { contains: q } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        walletBalance: true,
        loginFeeLkr: true,
        isActive: true,
        createdAt: true,
        agency: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            featureDriversAndPartners: true,
            featureSupport: true,
            featureWalletTopup: true,
            featureOffers: true,
            featureDisplay: true,
            featureReadyMadeTours: true,
            featureCustomInquiries: true,
            featureNegotiationsBookings: true,
            featureCustomDomain: true,
          },
        },
        agencyStaff: {
          take: 1,
          select: {
            agency: {
              select: {
                id: true,
                name: true,
                slug: true,
                status: true,
                featureDriversAndPartners: true,
                featureSupport: true,
                featureWalletTopup: true,
                featureOffers: true,
                featureDisplay: true,
                featureReadyMadeTours: true,
                featureCustomInquiries: true,
                featureNegotiationsBookings: true,
                featureCustomDomain: true,
              },
            },
          },
        },
      },
    });

    const payload = await Promise.all(
      users.map(async (u) => {
        const agencyRow = u.agency ?? u.agencyStaff[0]?.agency ?? null;
        const loginFeeOverride =
          u.loginFeeLkr != null ? Math.round(Number(u.loginFeeLkr)) : null;
        return {
          id: u.id,
          name: u.name,
          phone: u.phone,
          email: u.email,
          role: u.role,
          walletBalance: Number(u.walletBalance),
          loginFeeOverride,
          loginFee: await resolveLoginFeeForUser(u),
          isActive: u.isActive,
          createdAt: u.createdAt,
          agency: agencyRow
            ? {
                id: agencyRow.id,
                name: agencyRow.name,
                slug: agencyRow.slug,
                status: agencyRow.status,
                features: serializeAgencyFeatures(agencyRow),
              }
            : null,
        };
      })
    );
    res.json(payload);
  } catch (e) {
    next(e);
  }
});

adminRouter.patch("/users/:id", async (req, res, next) => {
  try {
    const body = z
      .object({
        isActive: z.boolean().optional(),
        role: z.enum(["TOURIST", "AGENCY", "INFLUENCER", "DRIVER", "ADMIN"]).optional(),
        name: z.string().min(1).optional(),
        email: z.string().email().nullable().optional(),
        /** null clears override (use role default). */
        loginFeeLkr: z.number().min(0).nullable().optional(),
      })
      .parse(req.body);

    const data: Prisma.UserUpdateInput = {};
    if (body.isActive !== undefined) data.isActive = body.isActive;
    if (body.role !== undefined) data.role = body.role;
    if (body.name !== undefined) data.name = body.name;
    if (body.email !== undefined) data.email = body.email;
    if (body.loginFeeLkr !== undefined) {
      data.loginFeeLkr =
        body.loginFeeLkr === null ? null : Math.round(body.loginFeeLkr);
    }

    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: req.params.id },
        data,
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          role: true,
          isActive: true,
          walletBalance: true,
          loginFeeLkr: true,
          agency: { select: { id: true, status: true } },
        },
      });

      // Hide / restore agency storefront when owner account is toggled.
      if (body.isActive === false && updated.agency?.status === "APPROVED") {
        await tx.agency.update({
          where: { id: updated.agency.id },
          data: { status: "SUSPENDED" },
        });
      }
      if (body.isActive === true && updated.agency?.status === "SUSPENDED") {
        await tx.agency.update({
          where: { id: updated.agency.id },
          data: { status: "APPROVED" },
        });
      }

      return updated;
    });

    const loginFeeOverride =
      user.loginFeeLkr != null ? Math.round(Number(user.loginFeeLkr)) : null;

    res.json({
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      walletBalance: Number(user.walletBalance),
      loginFeeOverride,
      loginFee: await resolveLoginFeeForUser(user),
    });
  } catch (e) {
    next(e);
  }
});

adminRouter.post("/users/:id/wallet-adjust", async (req, res, next) => {
  try {
    const body = z
      .object({
        amount: z.number(),
        note: z.string().min(3).max(500),
      })
      .parse(req.body);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.params.id } });
    const balance = Number(user.walletBalance);
    const newBalance = balance + body.amount;
    if (newBalance < 0) {
      return res.status(400).json({ error: "Adjustment would make balance negative" });
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { walletBalance: newBalance },
      }),
      prisma.walletLedger.create({
        data: {
          userId: user.id,
          type: "ADJUSTMENT",
          amountLkr: body.amount,
          balanceAfter: newBalance,
          note: `Admin: ${body.note}`,
        },
      }),
    ]);

    res.json({ walletBalance: newBalance });
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/tours", async (_req, res, next) => {
  try {
    const tours = await prisma.tour.findMany({
      orderBy: { updatedAt: "desc" },
      take: 300,
      select: {
        id: true,
        title: true,
        slug: true,
        days: true,
        isPublished: true,
        basePriceLkr: true,
        coverUrl: true,
        updatedAt: true,
        agency: { select: { id: true, name: true, slug: true, status: true } },
      },
    });
    res.json(tours.map((t) => ({ ...t, basePriceLkr: Number(t.basePriceLkr) })));
  } catch (e) {
    next(e);
  }
});

adminRouter.patch("/tours/:id", async (req, res, next) => {
  try {
    const body = z
      .object({
        isPublished: z.boolean().optional(),
        title: z.string().optional(),
      })
      .parse(req.body);

    const tour = await prisma.tour.update({
      where: { id: req.params.id },
      data: body,
      select: {
        id: true,
        title: true,
        slug: true,
        isPublished: true,
        agency: { select: { name: true, slug: true } },
      },
    });
    res.json(tour);
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/inquiries", async (req, res, next) => {
  try {
    const status = req.query.status as InquiryStatus | undefined;
    const where: Prisma.InquiryWhereInput = status ? { status } : {};

    const inquiries = await prisma.inquiry.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 200,
      include: {
        tourist: { select: { id: true, name: true, phone: true } },
        agency: { select: { id: true, name: true, slug: true } },
        tour: { select: { id: true, title: true, slug: true } },
      },
    });

    res.json(
      inquiries.map((i) => ({
        id: i.id,
        status: i.status,
        type: i.type,
        pax: i.pax,
        startDate: i.startDate,
        createdAt: i.createdAt,
        updatedAt: i.updatedAt,
        tourist: i.tourist,
        agency: i.agency,
        tour: i.tour,
      }))
    );
  } catch (e) {
    next(e);
  }
});

adminRouter.patch("/inquiries/:id/status", async (req, res, next) => {
  try {
    const body = z
      .object({
        status: inquiryStatusSchema,
        note: z.string().max(2000).optional(),
      })
      .parse(req.body);

    const adminId = req.user!.id;

    const inquiry = await prisma.$transaction(async (tx) => {
      const updated = await tx.inquiry.update({
        where: { id: req.params.id },
        data: { status: body.status },
        include: {
          tourist: { select: { id: true, name: true, phone: true } },
          agency: { select: { id: true, name: true, slug: true } },
          tour: { select: { id: true, title: true, slug: true } },
        },
      });

      await tx.inquiryStatusLog.create({
        data: {
          inquiryId: updated.id,
          status: body.status,
          note: body.note ? `Admin: ${body.note}` : "Status updated by platform admin",
          actorId: adminId,
        },
      });

      return updated;
    });

    res.json({
      id: inquiry.id,
      status: inquiry.status,
      tourist: inquiry.tourist,
      agency: inquiry.agency,
      tour: inquiry.tour,
    });
  } catch (e) {
    next(e);
  }
});

adminRouter.post("/inquiries/:id/messages", async (req, res, next) => {
  try {
    const body = z.object({ message: z.string().min(1).max(4000) }).parse(req.body);

    const inquiry = await prisma.inquiry.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!inquiry) return res.status(404).json({ error: "Inquiry not found" });

    const message = await createInquiryMessage(
      inquiry.id,
      req.user!.id,
      InquiryMessageKind.ADMIN,
      body.message,
      "ADMIN_MESSAGE"
    );

    void notifyAdminInquiryMessage(inquiry.id, body.message).catch(console.error);

    res.status(201).json(serializeInquiryMessage(message));
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/commissions", async (req, res, next) => {
  try {
    const status = req.query.status as CommissionStatus | undefined;
    const where: Prisma.CommissionWhereInput = status ? { status } : {};

    const rows = await prisma.commission.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        referralCode: { select: { code: true } },
        influencer: {
          include: { user: { select: { id: true, name: true, phone: true } } },
        },
        inquiry: {
          select: {
            id: true,
            status: true,
            agency: { select: { name: true } },
            tourist: { select: { name: true } },
          },
        },
      },
    });

    res.json(
      rows.map((c) => ({
        id: c.id,
        amountLkr: Number(c.amountLkr),
        status: c.status,
        createdAt: c.createdAt,
        code: c.referralCode.code,
        influencer: {
          id: c.influencer.id,
          name: c.influencer.user.name,
          phone: c.influencer.user.phone,
        },
        inquiry: c.inquiry,
      }))
    );
  } catch (e) {
    next(e);
  }
});

adminRouter.patch("/commissions/:id", async (req, res, next) => {
  try {
    const body = z.object({ status: commissionStatusSchema }).parse(req.body);

    if (body.status === "PAID") {
      const result = await creditCommissionPayout(req.params.id);
      if (!result.alreadyPaid && result.user && result.amountLkr != null) {
        await notifyCommissionPaid(
          result.user.id,
          result.user.name,
          result.user.email,
          result.amountLkr,
          result.balance
        );
      }
      const commission = await prisma.commission.findUniqueOrThrow({
        where: { id: req.params.id },
      });
      return res.json({
        ...commission,
        amountLkr: Number(commission.amountLkr),
        walletBalance: result.balance,
      });
    }

    const commission = await prisma.commission.update({
      where: { id: req.params.id },
      data: { status: body.status },
    });
    res.json({ ...commission, amountLkr: Number(commission.amountLkr) });
  } catch (e) {
    const err = e as Error & { status?: number };
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(e);
  }
});

adminRouter.get("/influencers", async (_req, res, next) => {
  try {
    const profiles = await prisma.influencerProfile.findMany({
      include: {
        user: { select: { id: true, name: true, phone: true, email: true, walletBalance: true } },
        _count: { select: { codes: true, commissions: true } },
      },
      orderBy: { id: "desc" },
    });
    res.json(
      profiles.map((p) => ({
        id: p.id,
        bio: p.bio,
        user: { ...p.user, walletBalance: Number(p.user.walletBalance) },
        codeCount: p._count.codes,
        commissionCount: p._count.commissions,
      }))
    );
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/ledger", async (req, res, next) => {
  try {
    const userId = typeof req.query.userId === "string" ? req.query.userId : undefined;
    const rows = await prisma.walletLedger.findMany({
      where: userId ? { userId } : undefined,
      orderBy: { createdAt: "desc" },
      take: 300,
      include: { user: { select: { id: true, name: true, phone: true, role: true } } },
    });
    res.json(
      rows.map((r) => ({
        id: r.id,
        type: r.type,
        amountLkr: Number(r.amountLkr),
        balanceAfter: Number(r.balanceAfter),
        note: r.note,
        createdAt: r.createdAt,
        user: r.user,
      }))
    );
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/reviews", async (_req, res, next) => {
  try {
    const reviews = await prisma.review.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { agency: { select: { id: true, name: true, slug: true } } },
    });
    res.json(reviews);
  } catch (e) {
    next(e);
  }
});

adminRouter.patch("/reviews/:id", async (req, res, next) => {
  try {
    const body = z.object({ isVisible: z.boolean() }).parse(req.body);
    const review = await prisma.review.update({
      where: { id: req.params.id },
      data: { isVisible: body.isVisible },
    });
    res.json(review);
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/drivers", async (_req, res, next) => {
  try {
    const [agencyDrivers, profiles] = await Promise.all([
      prisma.agencyDriver.findMany({
        orderBy: { updatedAt: "desc" },
        take: 200,
        include: {
          agency: { select: { id: true, name: true, slug: true } },
          user: { select: { id: true, name: true, phone: true } },
          _count: { select: { assignments: true } },
        },
      }),
      prisma.driverProfile.findMany({
        include: {
          user: { select: { id: true, name: true, phone: true, email: true, isActive: true } },
        },
      }),
    ]);

    res.json({
      agencyDrivers: agencyDrivers.map((d) => ({
        id: d.id,
        name: d.name,
        phone: d.phone,
        vehicle: d.vehicle,
        status: d.status,
        agency: d.agency,
        userId: d.userId,
        user: d.user,
        assignmentCount: d._count.assignments,
      })),
      driverProfiles: profiles.map((p) => ({
        id: p.id,
        licenseNo: p.licenseNo,
        vehicle: p.vehicle,
        status: p.status,
        user: p.user,
      })),
    });
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/itineraries", async (_req, res, next) => {
  try {
    const rows = await prisma.itinerary.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        title: true,
        shareToken: true,
        isSent: true,
        sentAt: true,
        createdAt: true,
        inquiry: {
          select: {
            id: true,
            status: true,
            agency: { select: { name: true, slug: true } },
            tourist: { select: { name: true } },
          },
        },
      },
    });
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

adminRouter.patch("/itineraries/:id/share", async (req, res, next) => {
  try {
    const body = z
      .object({
        revoke: z.boolean().optional(),
        regenerate: z.boolean().optional(),
      })
      .parse(req.body);

    let shareToken: string | null | undefined;
    if (body.revoke) shareToken = null;
    else if (body.regenerate) shareToken = randomUUID();

    const itinerary = await prisma.itinerary.update({
      where: { id: req.params.id },
      data: shareToken !== undefined ? { shareToken } : {},
      select: { id: true, shareToken: true, title: true },
    });
    res.json(itinerary);
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/cms", async (_req, res, next) => {
  try {
    const pages = await prisma.cmsPage.findMany({ orderBy: { slug: "asc" } });
    res.json(pages);
  } catch (e) {
    next(e);
  }
});

adminRouter.put("/cms/:slug", async (req, res, next) => {
  try {
    const body = z
      .object({
        title: z.string(),
        blocks: z.array(z.record(z.unknown())),
        isPublished: z.boolean().optional(),
      })
      .parse(req.body);

    const page = await prisma.cmsPage.upsert({
      where: { slug: req.params.slug },
      create: {
        slug: req.params.slug,
        title: body.title,
        blocks: asJson(body.blocks),
        isPublished: body.isPublished,
      },
      update: {
        title: body.title,
        blocks: asJson(body.blocks),
        isPublished: body.isPublished,
      },
    });

    res.json(page);
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/offers/:id/registrations", async (req, res, next) => {
  try {
    const regs = await prisma.offerRegistration.findMany({
      where: { offerId: req.params.id },
      include: { user: { select: { id: true, name: true, phone: true, createdAt: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(regs);
  } catch (e) {
    next(e);
  }
});
