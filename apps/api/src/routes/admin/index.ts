import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import type { AgencyStatus, CommissionStatus, InquiryStatus, Prisma, UserRole } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { config } from "../../lib/config.js";
import { authRequired, requireRoles } from "../../middleware/auth.js";
import { asJson } from "../../utils/json.js";
import {
  absolutePublicUrl,
  agencyRejectionEmail,
  finalizeEmailTemplate,
  getEmailDeliveryStatus,
  promotionalEmail,
  sendPlatformEmail,
  verifySmtpConnection,
} from "../../services/email.js";
import { InquiryMessageKind } from "@prisma/client";
import { createInquiryMessage, serializeInquiryMessage } from "../../services/inquiryMessages.js";
import {
  notifyAdminInquiryMessage,
  notifyAgencyApproved,
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
import { isValidInternationalPhone, toStoredPhone } from "../../utils/phone.js";
import { duplicateAdminUser } from "../../services/duplicateAdminUser.js";
import { recordAuditEvent } from "../../services/auditLog.js";

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
        sessionInactivityHours: z.number().int().min(1).max(168).optional(),
        sessionInactivityMinutes: z.number().int().min(1).max(10080).optional(),
        emailTemplates: z
          .record(
            z.string(),
            z.object({
              subject: z.string().max(200).optional(),
              body: z.string().max(8000).optional(),
            })
          )
          .optional(),
        supportContent: z
          .object({
            title: z.string().max(120),
            subtitle: z.string().max(500),
            footer: z.string().max(500),
            agents: z
              .array(
                z.object({
                  id: z.string().min(1).max(64),
                  name: z.string().max(120),
                  role: z.string().max(120),
                  service: z.string().max(120),
                  description: z.string().max(2000),
                  priceUsd: z.number().min(0),
                  priceLabel: z.string().max(80),
                  phone: z.string().max(40),
                  phoneDisplay: z.string().max(40),
                })
              )
              .max(20),
          })
          .optional(),
      })
      .parse(req.body);
    const before = await getPlatformSettings();
    const after = await updatePlatformSettings(body);
    await recordAuditEvent({
      actor: req.user!,
      entityType: "PLATFORM_SETTINGS",
      entityId: "default",
      entityLabel: "Platform settings",
      action: "UPDATE",
      summary: "Updated platform settings (fees, email, session, support)",
      before,
      after,
    });
    res.json(after);
  } catch (e) {
    next(e);
  }
});

const promoAudienceRoles = z.enum(["TOURIST", "AGENCY", "INFLUENCER", "DRIVER"]);

adminRouter.get("/email-status", async (_req, res, next) => {
  try {
    res.json(getEmailDeliveryStatus());
  } catch (e) {
    next(e);
  }
});

adminRouter.post("/email-status/verify", async (_req, res, next) => {
  try {
    const status = getEmailDeliveryStatus();
    if (status.mode !== "smtp") {
      return res.json({
        ...status,
        ok: false,
        error: `EMAIL_MODE is "${status.mode}" — set EMAIL_MODE=smtp to send real mail`,
      });
    }
    const result = await verifySmtpConnection();
    res.json({ ...status, ...result });
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/promo-email/audience", async (req, res, next) => {
  try {
    const rolesRaw = typeof req.query.roles === "string" ? req.query.roles : "";
    const roles = rolesRaw
      .split(",")
      .map((r) => r.trim().toUpperCase())
      .filter((r): r is z.infer<typeof promoAudienceRoles> =>
        ["TOURIST", "AGENCY", "INFLUENCER", "DRIVER"].includes(r)
      );
    const where = {
      isActive: true,
      AND: [{ email: { not: null } }, { NOT: { email: "" } }],
      role: {
        in: (roles.length
          ? roles
          : (["TOURIST", "AGENCY", "INFLUENCER", "DRIVER"] as UserRole[])),
      },
    };
    const count = await prisma.user.count({ where });
    res.json({ count, roles: roles.length ? roles : ["TOURIST", "AGENCY", "INFLUENCER", "DRIVER"] });
  } catch (e) {
    next(e);
  }
});

adminRouter.post("/promo-email", async (req, res, next) => {
  try {
    const body = z
      .object({
        subject: z.string().min(3).max(200),
        body: z.string().min(3).max(8000),
        posterUrl: z.string().max(2000).optional().nullable(),
        offerId: z.string().optional().nullable(),
        roles: z
          .array(promoAudienceRoles)
          .default(["TOURIST", "AGENCY", "INFLUENCER", "DRIVER"]),
        testTo: z.string().email().optional().nullable(),
      })
      .superRefine((val, ctx) => {
        if (!val.testTo?.trim() && val.roles.length < 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Select at least one audience role",
            path: ["roles"],
          });
        }
      })
      .parse(req.body);

    const settings = await getPlatformSettings();
    const base = (settings.webAppUrl || "").replace(/\/$/, "") || "https://srilankatourpilot.com";

    let offerTitle: string | undefined;
    let offerUrl: string | undefined;
    if (body.offerId) {
      const offer = await prisma.offer.findUnique({ where: { id: body.offerId } });
      if (!offer) {
        return res.status(404).json({ error: "Offer not found" });
      }
      offerTitle = offer.title;
      offerUrl = `${base}/offers?offer=${encodeURIComponent(offer.id)}`;
    }

    const posterUrl = body.posterUrl?.trim()
      ? absolutePublicUrl(body.posterUrl.trim(), base)
      : undefined;

    if (body.testTo?.trim()) {
      const content = promotionalEmail({
        recipientName: "there",
        subject: body.subject.trim(),
        body: body.body.trim(),
        posterUrl,
        offerTitle,
        offerUrl,
      });
      const result = await sendPlatformEmail({ to: body.testTo.trim(), ...content });
      return res.json({
        mode: "test",
        deliveryMode: result.mode,
        sent: result.delivered ? 1 : 0,
        failed: result.delivered ? 0 : 1,
        errors: result.error
          ? [result.error]
          : result.mode === "log"
            ? [
                "EMAIL_MODE=log — message was only printed in the API console, not emailed. Set EMAIL_MODE=smtp and SMTP_* in apps/api/.env, then restart the API.",
              ]
            : [],
      });
    }

    const recipients = await prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: body.roles },
        AND: [{ email: { not: null } }, { NOT: { email: "" } }],
      },
      select: { id: true, name: true, email: true },
    });

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];
    const chunkSize = 15;

    for (let i = 0; i < recipients.length; i += chunkSize) {
      const chunk = recipients.slice(i, i + chunkSize);
      const results = await Promise.all(
        chunk.map(async (user) => {
          const to = user.email!.trim();
          if (!to) return { ok: false, error: "empty email" };
          const content = promotionalEmail({
            recipientName: user.name || "there",
            subject: body.subject.trim(),
            body: body.body.trim(),
            posterUrl,
            offerTitle,
            offerUrl,
          });
          const result = await sendPlatformEmail({ to, ...content });
          return { ok: result.delivered, error: result.error };
        })
      );
      for (const r of results) {
        if (r.ok) sent += 1;
        else {
          failed += 1;
          if (r.error && errors.length < 10) errors.push(r.error);
        }
      }
    }

    res.json({
      mode: "broadcast",
      deliveryMode: config.email.mode,
      audience: recipients.length,
      sent,
      failed,
      errors,
      offerTitle: offerTitle || null,
      offerUrl: offerUrl || null,
    });
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
        sessionInactivityHours: a.sessionInactivityHours,
        sessionInactivityMinutes: a.sessionInactivityMinutes,
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
    const body = z
      .object({
        sendEmail: z.boolean().optional().default(true),
      })
      .parse(req.body ?? {});

    const agency = await prisma.agency.update({
      where: { id: req.params.id },
      data: {
        status: "APPROVED",
        rejectionReason: null,
        rejectedAt: null,
      },
    });

    if (body.sendEmail) {
      void notifyAgencyApproved(agency.id).catch((err) =>
        console.error("[agency approved email]", err)
      );
    }

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
        externalStorefront: z.boolean().optional(),
        sessionInactivityTimeout: z.boolean().optional(),
        /** null clears override (use platform default). Preferred unit: minutes. */
        sessionInactivityMinutes: z.number().int().min(1).max(10080).nullable().optional(),
        /** Legacy hours override — converted to minutes when minutes omitted. */
        sessionInactivityHours: z.number().int().min(1).max(168).nullable().optional(),
      })
      .refine(
        (v) =>
          Object.keys(v).some(
            (k) => k !== "sessionInactivityHours" && k !== "sessionInactivityMinutes"
          ) ||
          v.sessionInactivityHours !== undefined ||
          v.sessionInactivityMinutes !== undefined,
        { message: "At least one feature flag is required" }
      )
      .parse(req.body);

    const { sessionInactivityHours, sessionInactivityMinutes, ...featureFlags } = body;
    let minutesUpdate: { sessionInactivityMinutes: number | null; sessionInactivityHours: number | null } | undefined;
    if (sessionInactivityMinutes !== undefined) {
      minutesUpdate = {
        sessionInactivityMinutes,
        sessionInactivityHours:
          sessionInactivityMinutes == null
            ? null
            : Math.max(1, Math.ceil(sessionInactivityMinutes / 60)),
      };
    } else if (sessionInactivityHours !== undefined) {
      minutesUpdate = {
        sessionInactivityHours,
        sessionInactivityMinutes:
          sessionInactivityHours == null ? null : sessionInactivityHours * 60,
      };
    }
    const data = {
      ...agencyFeatureDbFields(featureFlags as Partial<AgencyFeatures>),
      ...(minutesUpdate ?? {}),
    };

    const before = await prisma.agency.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        featureDriversAndPartners: true,
        featureSupport: true,
        featureWalletTopup: true,
        featureOffers: true,
        featureDisplay: true,
        featureReadyMadeTours: true,
        featureCustomInquiries: true,
        featureNegotiationsBookings: true,
        featureCustomDomain: true,
        featureExternalStorefront: true,
        featureSessionInactivityTimeout: true,
        sessionInactivityHours: true,
        sessionInactivityMinutes: true,
      },
    });
    if (!before) return res.status(404).json({ error: "Agency not found" });

    const agency = await prisma.agency.update({
      where: { id: req.params.id },
      data,
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
        featureExternalStorefront: true,
        featureSessionInactivityTimeout: true,
        sessionInactivityHours: true,
        sessionInactivityMinutes: true,
      },
    });

    await recordAuditEvent({
      actor: req.user!,
      agencyId: agency.id,
      entityType: "AGENCY_FEATURES",
      entityId: agency.id,
      entityLabel: agency.name,
      action: "UPDATE",
      summary: `Updated feature flags for agency "${agency.name}"`,
      before: {
        features: serializeAgencyFeatures(before),
        sessionInactivityHours: before.sessionInactivityHours,
        sessionInactivityMinutes: before.sessionInactivityMinutes,
      },
      after: {
        features: serializeAgencyFeatures(agency),
        sessionInactivityHours: agency.sessionInactivityHours,
        sessionInactivityMinutes: agency.sessionInactivityMinutes,
      },
    });

    res.json({
      id: agency.id,
      name: agency.name,
      slug: agency.slug,
      status: agency.status,
      features: serializeAgencyFeatures(agency),
      sessionInactivityHours: agency.sessionInactivityHours,
      sessionInactivityMinutes: agency.sessionInactivityMinutes,
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
            featureExternalStorefront: true,
            featureSessionInactivityTimeout: true,
            sessionInactivityHours: true,
            sessionInactivityMinutes: true,
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
                featureExternalStorefront: true,
                featureSessionInactivityTimeout: true,
                sessionInactivityHours: true,
                sessionInactivityMinutes: true,
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
                sessionInactivityHours: agencyRow.sessionInactivityHours,
                sessionInactivityMinutes: agencyRow.sessionInactivityMinutes,
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
        name: z.string().min(1).max(120).optional(),
        phone: z.string().min(8).optional(),
        email: z.string().email().nullable().optional(),
        /** null clears override (use role default). */
        loginFeeLkr: z.number().min(0).nullable().optional(),
      })
      .parse(req.body);

    const data: Prisma.UserUpdateInput = {};
    if (body.isActive !== undefined) data.isActive = body.isActive;
    if (body.role !== undefined) data.role = body.role;
    if (body.name !== undefined) data.name = body.name.trim();
    if (body.email !== undefined) data.email = body.email;
    if (body.loginFeeLkr !== undefined) {
      data.loginFeeLkr =
        body.loginFeeLkr === null ? null : Math.round(body.loginFeeLkr);
    }
    if (body.phone !== undefined) {
      const phone = toStoredPhone(body.phone);
      if (!isValidInternationalPhone(phone)) {
        return res.status(400).json({
          error: "Invalid phone number. Include country code (e.g. +94771234567).",
        });
      }
      const clash = await prisma.user.findFirst({
        where: { phone, NOT: { id: req.params.id } },
        select: { id: true },
      });
      if (clash) {
        return res.status(409).json({ error: "Another account already uses that phone" });
      }
      data.phone = phone;
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

adminRouter.post("/users", async (req, res, next) => {
  try {
    const body = z
      .object({
        name: z.string().min(1).max(120),
        phone: z.string().min(8),
        email: z.string().email().nullable().optional(),
        role: z.enum(["TOURIST", "AGENCY", "INFLUENCER", "DRIVER", "ADMIN"]),
        isActive: z.boolean().optional(),
        walletBalance: z.number().min(0).optional(),
        loginFeeLkr: z.number().min(0).nullable().optional(),
      })
      .parse(req.body);

    const phone = toStoredPhone(body.phone);
    if (!isValidInternationalPhone(phone)) {
      return res.status(400).json({
        error: "Invalid phone number. Include country code (e.g. +94771234567).",
      });
    }

    const exists = await prisma.user.findUnique({ where: { phone } });
    if (exists) {
      return res.status(409).json({ error: "Account already exists for this phone" });
    }

    const wallet = Math.round(body.walletBalance ?? 0);
    const user = await prisma.user.create({
      data: {
        name: body.name.trim(),
        phone,
        email: body.email ?? null,
        role: body.role,
        isActive: body.isActive ?? true,
        walletBalance: wallet,
        loginFeeLkr:
          body.loginFeeLkr === undefined
            ? undefined
            : body.loginFeeLkr === null
              ? null
              : Math.round(body.loginFeeLkr),
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        isActive: true,
        walletBalance: true,
        loginFeeLkr: true,
      },
    });

    if (wallet > 0) {
      await prisma.walletLedger.create({
        data: {
          userId: user.id,
          type: "ADJUSTMENT",
          amountLkr: wallet,
          balanceAfter: wallet,
          note: "Admin: opening balance",
        },
      });
    }

    const loginFeeOverride =
      user.loginFeeLkr != null ? Math.round(Number(user.loginFeeLkr)) : null;

    res.status(201).json({
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      walletBalance: Number(user.walletBalance),
      loginFeeOverride,
      loginFee: await resolveLoginFeeForUser(user),
      agency: null,
    });
  } catch (e) {
    next(e);
  }
});

/**
 * Duplicate a user. Admin must supply a new unique phone.
 * When the source owns an agency, clones agency profile, display settings,
 * entities, entity groups, and tours (with itinerary days/items).
 */
adminRouter.post("/users/:id/duplicate", async (req, res, next) => {
  try {
    const body = z
      .object({
        name: z.string().min(1).max(120),
        phone: z.string().min(8),
        email: z.string().email().nullable().optional(),
        role: z.enum(["TOURIST", "AGENCY", "INFLUENCER", "DRIVER", "ADMIN"]),
        isActive: z.boolean().optional(),
        walletBalance: z.number().min(0).optional(),
        loginFeeLkr: z.number().min(0).nullable().optional(),
        agencyName: z.string().min(1).max(160).optional(),
      })
      .parse(req.body);

    const duplicated = await duplicateAdminUser(req.params.id, body);
    res.status(201).json({
      ...duplicated,
      loginFee: await resolveLoginFeeForUser({
        role: duplicated.role as UserRole,
        loginFeeLkr: duplicated.loginFeeOverride,
      }),
    });
  } catch (e) {
    const err = e as Error & { status?: number };
    if (err.status === 400 || err.status === 404 || err.status === 409) {
      return res.status(err.status).json({ error: err.message });
    }
    next(e);
  }
});

/**
 * Hard-delete a user. Cleans Inquiry/Commission rows that lack onDelete: Cascade
 * so agency owners and tourists with trip history can be removed.
 */
adminRouter.delete("/users/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    if (id === req.user!.id) {
      return res.status(400).json({ error: "You cannot delete your own admin account" });
    }

    const target = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        role: true,
        agency: { select: { id: true, name: true } },
        influencerProfile: { select: { id: true } },
      },
    });
    if (!target) return res.status(404).json({ error: "User not found" });

    if (target.role === "ADMIN") {
      const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
      if (adminCount <= 1) {
        return res.status(400).json({ error: "Cannot delete the last admin account" });
      }
    }

    await prisma.$transaction(async (tx) => {
      const inquiryIds: string[] = [];

      if (target.agency) {
        const agencyInquiries = await tx.inquiry.findMany({
          where: { agencyId: target.agency.id },
          select: { id: true },
        });
        inquiryIds.push(...agencyInquiries.map((i) => i.id));
      }

      const touristInquiries = await tx.inquiry.findMany({
        where: { touristId: id },
        select: { id: true },
      });
      inquiryIds.push(...touristInquiries.map((i) => i.id));

      const uniqueInquiryIds = Array.from(new Set(inquiryIds));
      if (uniqueInquiryIds.length) {
        await tx.commission.deleteMany({ where: { inquiryId: { in: uniqueInquiryIds } } });
        await tx.inquiry.deleteMany({ where: { id: { in: uniqueInquiryIds } } });
      }

      if (target.influencerProfile) {
        await tx.commission.deleteMany({
          where: { influencerId: target.influencerProfile.id },
        });
      }

      await tx.user.delete({ where: { id } });
    });

    res.json({
      ok: true,
      deletedId: id,
      name: target.name,
      agencyDeleted: Boolean(target.agency),
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

    const existing = await prisma.tour.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        title: true,
        slug: true,
        isPublished: true,
        agencyId: true,
        agency: { select: { name: true, slug: true } },
      },
    });
    if (!existing) return res.status(404).json({ error: "Tour not found" });

    const tour = await prisma.tour.update({
      where: { id: req.params.id },
      data: body,
      select: {
        id: true,
        title: true,
        slug: true,
        isPublished: true,
        agencyId: true,
        agency: { select: { name: true, slug: true } },
      },
    });

    const action =
      body.isPublished === undefined || existing.isPublished === tour.isPublished
        ? ("UPDATE" as const)
        : tour.isPublished
          ? ("PUBLISH" as const)
          : ("UNPUBLISH" as const);

    await recordAuditEvent({
      actor: req.user!,
      agencyId: tour.agencyId,
      entityType: "TOUR",
      entityId: tour.id,
      entityLabel: tour.title,
      action,
      summary: `Admin ${action.toLowerCase()} tour "${tour.title}" (${tour.agency.name})`,
      before: {
        title: existing.title,
        isPublished: existing.isPublished,
      },
      after: {
        title: tour.title,
        isPublished: tour.isPublished,
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

adminRouter.get("/audit-events", async (req, res, next) => {
  try {
    const entityType = typeof req.query.entityType === "string" ? req.query.entityType : undefined;
    const entityId = typeof req.query.entityId === "string" ? req.query.entityId : undefined;
    const agencyId = typeof req.query.agencyId === "string" ? req.query.agencyId : undefined;
    const actorId = typeof req.query.actorId === "string" ? req.query.actorId : undefined;
    const action = typeof req.query.action === "string" ? req.query.action : undefined;
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const take = Math.min(500, Math.max(1, Number(req.query.take) || 200));

    const where: Prisma.AuditEventWhereInput = {};
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (agencyId) where.agencyId = agencyId;
    if (actorId) where.actorId = actorId;
    if (action) where.action = action;
    if (q) {
      where.OR = [
        { summary: { contains: q } },
        { entityLabel: { contains: q } },
        { actorName: { contains: q } },
        { entityId: { contains: q } },
      ];
    }

    const rows = await prisma.auditEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      include: {
        agency: { select: { id: true, name: true, slug: true } },
        actor: { select: { id: true, name: true, phone: true, role: true } },
      },
    });

    res.json(
      rows.map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        entityType: r.entityType,
        entityId: r.entityId,
        entityLabel: r.entityLabel,
        action: r.action,
        summary: r.summary,
        before: r.beforeJson,
        after: r.afterJson,
        changes: r.changesJson,
        relatedInquiryId: r.relatedInquiryId,
        actor: r.actor
          ? {
              id: r.actor.id,
              name: r.actor.name,
              phone: r.actor.phone,
              role: r.actor.role,
            }
          : r.actorId
            ? {
                id: r.actorId,
                name: r.actorName,
                phone: r.actorPhone,
                role: r.actorRole,
              }
            : null,
        agency: r.agency,
      }))
    );
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/audit-events/:id", async (req, res, next) => {
  try {
    const row = await prisma.auditEvent.findUnique({
      where: { id: req.params.id },
      include: {
        agency: { select: { id: true, name: true, slug: true } },
        actor: { select: { id: true, name: true, phone: true, role: true } },
      },
    });
    if (!row) return res.status(404).json({ error: "Audit event not found" });
    res.json({
      id: row.id,
      createdAt: row.createdAt,
      entityType: row.entityType,
      entityId: row.entityId,
      entityLabel: row.entityLabel,
      action: row.action,
      summary: row.summary,
      before: row.beforeJson,
      after: row.afterJson,
      changes: row.changesJson,
      relatedInquiryId: row.relatedInquiryId,
      actor: row.actor
        ? {
            id: row.actor.id,
            name: row.actor.name,
            phone: row.actor.phone,
            role: row.actor.role,
          }
        : row.actorId
          ? {
              id: row.actorId,
              name: row.actorName,
              phone: row.actorPhone,
              role: row.actorRole,
            }
          : null,
      agency: row.agency,
    });
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

    const existing = await prisma.cmsPage.findUnique({ where: { slug: req.params.slug } });

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

    await recordAuditEvent({
      actor: req.user!,
      entityType: "CMS_PAGE",
      entityId: page.slug,
      entityLabel: page.title,
      action: existing ? "UPDATE" : "CREATE",
      summary: `${existing ? "Updated" : "Created"} CMS page "${page.title}" (${page.slug})`,
      before: existing
        ? { title: existing.title, isPublished: existing.isPublished, blocks: existing.blocks }
        : null,
      after: { title: page.title, isPublished: page.isPublished, blocks: page.blocks },
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

const voucherDiscountTypeSchema = z.enum(["FIXED_LKR", "PERCENT"]);

const voucherBodySchema = z.object({
  code: z.string().trim().min(3).max(64),
  description: z.string().trim().max(2000).optional().nullable(),
  discountType: voucherDiscountTypeSchema,
  discountValue: z.number().positive(),
  maxUses: z.number().int().positive().optional().nullable(),
  minInvoiceLkr: z.number().min(0).optional().nullable(),
  maxDiscountLkr: z.number().min(0).optional().nullable(),
  validFrom: z.string().datetime().optional().nullable(),
  validUntil: z.string().datetime().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

adminRouter.get("/vouchers", async (_req, res, next) => {
  try {
    const { serializeVoucher } = await import("../../services/vouchers.js");
    const list = await prisma.voucher.findMany({ orderBy: { createdAt: "desc" } });
    res.json(list.map(serializeVoucher));
  } catch (e) {
    next(e);
  }
});

adminRouter.post("/vouchers", async (req, res, next) => {
  try {
    const { normalizeVoucherCode, serializeVoucher } = await import("../../services/vouchers.js");
    const body = voucherBodySchema.parse(req.body);
    const code = normalizeVoucherCode(body.code);
    const existing = await prisma.voucher.findUnique({ where: { code } });
    if (existing) return res.status(409).json({ error: "A voucher with this code already exists" });

    if (body.discountType === "PERCENT" && body.discountValue > 100) {
      return res.status(400).json({ error: "Percentage discount cannot exceed 100" });
    }

    const voucher = await prisma.voucher.create({
      data: {
        code,
        description: body.description?.trim() || null,
        discountType: body.discountType,
        discountValue: body.discountValue,
        maxUses: body.maxUses ?? null,
        minInvoiceLkr: body.minInvoiceLkr ?? null,
        maxDiscountLkr: body.maxDiscountLkr ?? null,
        validFrom: body.validFrom ? new Date(body.validFrom) : null,
        validUntil: body.validUntil ? new Date(body.validUntil) : null,
        isActive: body.isActive ?? true,
        createdById: req.user!.id,
      },
    });
    res.status(201).json(serializeVoucher(voucher));
  } catch (e) {
    next(e);
  }
});

adminRouter.patch("/vouchers/:id", async (req, res, next) => {
  try {
    const { normalizeVoucherCode, serializeVoucher } = await import("../../services/vouchers.js");
    const body = voucherBodySchema.partial().parse(req.body);
    const existing = await prisma.voucher.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Voucher not found" });

    if (body.discountType === "PERCENT" && body.discountValue != null && body.discountValue > 100) {
      return res.status(400).json({ error: "Percentage discount cannot exceed 100" });
    }

    let code = existing.code;
    if (body.code != null) {
      code = normalizeVoucherCode(body.code);
      if (code !== existing.code) {
        const clash = await prisma.voucher.findUnique({ where: { code } });
        if (clash) return res.status(409).json({ error: "A voucher with this code already exists" });
      }
    }

    const voucher = await prisma.voucher.update({
      where: { id: existing.id },
      data: {
        code,
        description: body.description === undefined ? undefined : body.description?.trim() || null,
        discountType: body.discountType,
        discountValue: body.discountValue,
        maxUses: body.maxUses === undefined ? undefined : body.maxUses,
        minInvoiceLkr: body.minInvoiceLkr === undefined ? undefined : body.minInvoiceLkr,
        maxDiscountLkr: body.maxDiscountLkr === undefined ? undefined : body.maxDiscountLkr,
        validFrom:
          body.validFrom === undefined
            ? undefined
            : body.validFrom
              ? new Date(body.validFrom)
              : null,
        validUntil:
          body.validUntil === undefined
            ? undefined
            : body.validUntil
              ? new Date(body.validUntil)
              : null,
        isActive: body.isActive,
      },
    });
    res.json(serializeVoucher(voucher));
  } catch (e) {
    next(e);
  }
});

adminRouter.delete("/vouchers/:id", async (req, res, next) => {
  try {
    const existing = await prisma.voucher.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Voucher not found" });
    await prisma.voucher.update({
      where: { id: existing.id },
      data: { isActive: false },
    });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});
