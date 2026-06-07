import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import {
  assignmentDateKeys,
  normalizeBlockedDates,
  parseBlockedDates,
} from "../lib/driverBlockedDates.js";
import { authRequired, getAgencyForUser, requireRoles } from "../middleware/auth.js";
import { asJson } from "../utils/json.js";
import { ensureDriverUserAccount, profileStatusFromAgency } from "../services/agencyDriverLink.js";
import { isValidInternationalPhone, toStoredPhone } from "../utils/phone.js";

export const driversRouter = Router();

const DRIVER_STATUSES = ["Available", "On Tour", "Off Duty"] as const;
const ASSIGNMENT_STATUSES = ["Scheduled", "On Route", "Completed", "Cancelled"] as const;

function serializeAssignment(a: {
  id: string;
  agencyDriverId: string;
  title: string;
  startDate: Date;
  endDate: Date | null;
  notes: string | null;
  status: string;
  inquiryId: string | null;
  tourId: string | null;
  createdAt: Date;
  agencyDriver?: { id: string; name: string; phone: string | null; vehicle: string | null };
  inquiry?: {
    id: string;
    pax: number;
    status: string;
    startDate: Date | null;
    endDate: Date | null;
    tourist: { name: string; phone: string };
    tour: { title: string } | null;
  } | null;
  tour?: { id: string; title: string; days: number } | null;
}) {
  return {
    id: a.id,
    agencyDriverId: a.agencyDriverId,
    driver: a.agencyDriver
      ? {
          id: a.agencyDriver.id,
          name: a.agencyDriver.name,
          phone: a.agencyDriver.phone,
          vehicle: a.agencyDriver.vehicle,
        }
      : undefined,
    title: a.title,
    startDate: a.startDate,
    endDate: a.endDate,
    notes: a.notes,
    status: a.status,
    inquiryId: a.inquiryId,
    tourId: a.tourId,
    createdAt: a.createdAt,
    inquiry: a.inquiry
      ? {
          id: a.inquiry.id,
          pax: a.inquiry.pax,
          status: a.inquiry.status,
          startDate: a.inquiry.startDate,
          endDate: a.inquiry.endDate,
          touristName: a.inquiry.tourist.name,
          touristPhone: a.inquiry.tourist.phone,
          tourTitle: a.inquiry.tour?.title ?? null,
        }
      : null,
    tour: a.tour ? { id: a.tour.id, title: a.tour.title, days: a.tour.days } : null,
  };
}

const assignmentInclude = {
  agencyDriver: { select: { id: true, name: true, phone: true, vehicle: true } },
  inquiry: {
    select: {
      id: true,
      pax: true,
      status: true,
      startDate: true,
      endDate: true,
      tourist: { select: { name: true, phone: true } },
      tour: { select: { title: true } },
    },
  },
  tour: { select: { id: true, title: true, days: true } },
} as const;

async function getDriverProfileForUser(userId: string) {
  return prisma.driverProfile.findUnique({
    where: { userId },
    include: {
      user: { select: { id: true, name: true, phone: true, email: true } },
    },
  });
}

async function getAgencyDriverForUser(userId: string) {
  return prisma.agencyDriver.findUnique({
    where: { userId },
    include: { agency: { select: { id: true, name: true, slug: true } } },
  });
}

driversRouter.get("/me", authRequired, requireRoles("DRIVER"), async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const [profile, agencyDriver] = await Promise.all([
      getDriverProfileForUser(userId),
      getAgencyDriverForUser(userId),
    ]);

    if (!profile) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    const metadata = (profile.metadata as Record<string, unknown> | null) || {};

    res.json({
      profile: {
        name: profile.user.name,
        phone: profile.user.phone,
        email: profile.user.email,
        licenseNo: profile.licenseNo,
        vehicle: profile.vehicle,
        status: profile.status,
        bio: profile.bio,
        experience: typeof metadata.experience === "string" ? metadata.experience : "",
        languages: typeof metadata.languages === "string" ? metadata.languages : "",
        availabilityNotes:
          typeof metadata.availabilityNotes === "string" ? metadata.availabilityNotes : "",
      },
      agencyDriver: agencyDriver
        ? {
            id: agencyDriver.id,
            agencyId: agencyDriver.agencyId,
            agencyName: agencyDriver.agency.name,
            status: agencyDriver.status,
          }
        : null,
      blockedDates: parseBlockedDates(profile.blockedDates),
      articles: Array.isArray(profile.articles) ? profile.articles : [],
    });
  } catch (e) {
    next(e);
  }
});

driversRouter.put("/me/profile", authRequired, requireRoles("DRIVER"), async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const body = z
      .object({
        name: z.string().min(1).optional(),
        licenseNo: z.string().optional(),
        vehicle: z.string().optional(),
        status: z.enum(DRIVER_STATUSES).optional(),
        bio: z.string().optional(),
        experience: z.string().optional(),
        languages: z.string().optional(),
        availabilityNotes: z.string().optional(),
      })
      .parse(req.body);

    const profile = await getDriverProfileForUser(userId);
    if (!profile) return res.status(404).json({ error: "Driver profile not found" });

    const metadata = {
      ...((profile.metadata as Record<string, unknown> | null) || {}),
      ...(body.experience !== undefined ? { experience: body.experience } : {}),
      ...(body.languages !== undefined ? { languages: body.languages } : {}),
      ...(body.availabilityNotes !== undefined
        ? { availabilityNotes: body.availabilityNotes }
        : {}),
    };

    await prisma.$transaction(async (tx) => {
      if (body.name) {
        await tx.user.update({ where: { id: userId }, data: { name: body.name.trim() } });
      }

      await tx.driverProfile.update({
        where: { userId },
        data: {
          licenseNo: body.licenseNo?.trim() || profile.licenseNo,
          vehicle: body.vehicle?.trim() || profile.vehicle,
          status: body.status || profile.status,
          bio: body.bio?.trim() ?? profile.bio,
          metadata: asJson(metadata),
        },
      });

      if (body.status) {
        await tx.agencyDriver.updateMany({
          where: { userId },
          data: { status: body.status },
        });
      }
    });

    const updated = await getDriverProfileForUser(userId);
    const agencyDriver = await getAgencyDriverForUser(userId);
    const meta = (updated!.metadata as Record<string, unknown> | null) || {};

    res.json({
      profile: {
        name: updated!.user.name,
        phone: updated!.user.phone,
        licenseNo: updated!.licenseNo,
        vehicle: updated!.vehicle,
        status: updated!.status,
        bio: updated!.bio,
        experience: typeof meta.experience === "string" ? meta.experience : "",
        languages: typeof meta.languages === "string" ? meta.languages : "",
        availabilityNotes:
          typeof meta.availabilityNotes === "string" ? meta.availabilityNotes : "",
      },
      agencyDriver: agencyDriver
        ? {
            id: agencyDriver.id,
            agencyId: agencyDriver.agencyId,
            agencyName: agencyDriver.agency.name,
            status: agencyDriver.status,
          }
        : null,
    });
  } catch (e) {
    next(e);
  }
});

driversRouter.get("/me/blocked-dates", authRequired, requireRoles("DRIVER"), async (req, res, next) => {
  try {
    const profile = await getDriverProfileForUser(req.user!.id);
    if (!profile) return res.status(404).json({ error: "Driver profile not found" });
    res.json({ blockedDates: parseBlockedDates(profile.blockedDates) });
  } catch (e) {
    next(e);
  }
});

driversRouter.put("/me/blocked-dates", authRequired, requireRoles("DRIVER"), async (req, res, next) => {
  try {
    const { dates } = z.object({ dates: z.array(z.string()) }).parse(req.body);
    const blockedDates = normalizeBlockedDates(dates);

    const profile = await prisma.driverProfile.findUnique({ where: { userId: req.user!.id } });
    if (!profile) return res.status(404).json({ error: "Driver profile not found" });

    await prisma.driverProfile.update({
      where: { userId: req.user!.id },
      data: { blockedDates: asJson(blockedDates) },
    });

    res.json({ blockedDates });
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Invalid date")) {
      return res.status(400).json({ error: e.message });
    }
    next(e);
  }
});

driversRouter.get("/me/earnings", authRequired, requireRoles("DRIVER"), async (req, res, next) => {
  try {
    const agencyDriver = await getAgencyDriverForUser(req.user!.id);
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.user!.id },
      include: { driverProfile: true },
    });

    if (!agencyDriver) {
      return res.json({
        walletBalance: Number(user.walletBalance),
        thisWeekLkr: 0,
        completedTrips: 0,
        upcomingTrips: 0,
        vehicle: user.driverProfile?.vehicle ?? null,
        licenseNo: user.driverProfile?.licenseNo ?? null,
        status: user.driverProfile?.status ?? "available",
        metadata: user.driverProfile?.metadata ?? null,
      });
    }

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const assignments = await prisma.driverAssignment.findMany({
      where: { agencyDriverId: agencyDriver.id },
      select: {
        id: true,
        status: true,
        startDate: true,
        endDate: true,
        title: true,
        inquiry: { select: { pax: true } },
      },
    });

    const completed = assignments.filter((a) => a.status === "Completed");
    const thisWeekCompleted = completed.filter((a) => {
      const d = new Date(a.endDate ?? a.startDate);
      return d >= weekStart;
    });

    const thisWeekLkr = thisWeekCompleted.length * 4500;

    res.json({
      walletBalance: Number(user.walletBalance),
      thisWeekLkr,
      completedTrips: completed.length,
      upcomingTrips: assignments.filter(
        (a) => a.status === "Scheduled" || a.status === "On Route"
      ).length,
      vehicle: user.driverProfile?.vehicle ?? agencyDriver.vehicle,
      licenseNo: user.driverProfile?.licenseNo ?? null,
      status: user.driverProfile?.status ?? "available",
      metadata: user.driverProfile?.metadata ?? null,
      recentCompleted: thisWeekCompleted.slice(0, 5).map((a) => ({
        id: a.id,
        title: a.title,
        date: a.endDate ?? a.startDate,
        pax: a.inquiry?.pax ?? null,
      })),
    });
  } catch (e) {
    next(e);
  }
});

driversRouter.get("/me/assignments", authRequired, requireRoles("DRIVER"), async (req, res, next) => {
  try {
    const agencyDriver = await getAgencyDriverForUser(req.user!.id);
    if (!agencyDriver) {
      return res.json([]);
    }

    const assignments = await prisma.driverAssignment.findMany({
      where: { agencyDriverId: agencyDriver.id, status: { not: "Cancelled" } },
      orderBy: { startDate: "asc" },
      include: assignmentInclude,
    });

    res.json(assignments.map(serializeAssignment));
  } catch (e) {
    next(e);
  }
});

driversRouter.get("/agency/assignments", authRequired, requireRoles("AGENCY"), async (req, res, next) => {
  try {
    const agency = await getAgencyForUser(req.user!.id);
    if (!agency) return res.status(404).json({ error: "Agency not found" });

    const assignments = await prisma.driverAssignment.findMany({
      where: { agencyDriver: { agencyId: agency.id } },
      orderBy: { startDate: "desc" },
      include: assignmentInclude,
    });

    res.json(assignments.map(serializeAssignment));
  } catch (e) {
    next(e);
  }
});

/** Agency: look up an existing platform driver by phone before adding to roster. */
driversRouter.get(
  "/agency/lookup-by-phone",
  authRequired,
  requireRoles("AGENCY"),
  async (req, res, next) => {
    try {
      const agency = await getAgencyForUser(req.user!.id);
      if (!agency) return res.status(404).json({ error: "Agency not found" });

      const phone = toStoredPhone(String(req.query.phone || ""));
      if (!isValidInternationalPhone(phone)) {
        return res.json({ found: false, invalidPhone: true });
      }

      const user = await prisma.user.findUnique({
        where: { phone },
        include: {
          driverProfile: true,
          agencyDriver: { include: { agency: { select: { id: true, name: true } } } },
        },
      });

      if (!user) {
        return res.json({ found: false });
      }

      if (user.role !== "DRIVER") {
        return res.json({
          found: true,
          locked: false,
          conflict: "wrong_role",
          message: "This phone is already used by another account type.",
        });
      }

      const alreadyOnRoster = user.agencyDriver?.agencyId === agency.id;
      const linkedToOtherAgency = Boolean(
        user.agencyDriver && user.agencyDriver.agencyId !== agency.id
      );

      return res.json({
        found: true,
        locked: true,
        alreadyOnRoster,
        linkedToOtherAgency,
        otherAgencyName: linkedToOtherAgency ? user.agencyDriver!.agency.name : null,
        name: user.name,
        phone: user.phone,
        licenseNo: user.driverProfile?.licenseNo ?? "",
        vehicle: user.driverProfile?.vehicle ?? "",
        message: alreadyOnRoster
          ? "This driver is already on your roster."
          : linkedToOtherAgency
            ? `This driver is already linked to ${user.agencyDriver!.agency.name}.`
            : "Existing driver — profile details are filled automatically.",
      });
    } catch (e) {
      next(e);
    }
  }
);

driversRouter.get("/agency/mine", authRequired, requireRoles("AGENCY"), async (req, res, next) => {
  try {
    const agency = await getAgencyForUser(req.user!.id);
    if (!agency) return res.status(404).json({ error: "Agency not found" });

    const status = String(req.query.status || "all");
    const drivers = await prisma.agencyDriver.findMany({
      where: {
        agencyId: agency.id,
        ...(status !== "all" ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            driverProfile: { select: { blockedDates: true } },
          },
        },
      },
    });

    res.json(
      drivers.map((d) => ({
        id: d.id,
        agencyId: d.agencyId,
        userId: d.userId,
        name: d.name,
        phone: d.phone,
        licenseNo: d.licenseNo,
        vehicle: d.vehicle,
        status: d.status,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        blockedDates: d.userId
          ? parseBlockedDates(d.user?.driverProfile?.blockedDates)
          : [],
        hasLogin: Boolean(d.userId),
      }))
    );
  } catch (e) {
    next(e);
  }
});

driversRouter.delete(
  "/assignments/:assignmentId",
  authRequired,
  requireRoles("AGENCY"),
  async (req, res, next) => {
    try {
      const agency = await getAgencyForUser(req.user!.id);
      if (!agency) return res.status(404).json({ error: "Agency not found" });

      const existing = await prisma.driverAssignment.findFirst({
        where: {
          id: req.params.assignmentId,
          agencyDriver: { agencyId: agency.id },
        },
      });
      if (!existing) return res.status(404).json({ error: "Assignment not found" });

      await prisma.driverAssignment.delete({ where: { id: existing.id } });
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  }
);

driversRouter.patch(
  "/assignments/:assignmentId",
  authRequired,
  requireRoles("AGENCY"),
  async (req, res, next) => {
    try {
      const agency = await getAgencyForUser(req.user!.id);
      if (!agency) return res.status(404).json({ error: "Agency not found" });

      const body = z
        .object({
          status: z.enum(ASSIGNMENT_STATUSES).optional(),
          notes: z.string().nullable().optional(),
          startDate: z.string().datetime().optional(),
          endDate: z.string().datetime().nullable().optional(),
        })
        .parse(req.body);

      const existing = await prisma.driverAssignment.findFirst({
        where: {
          id: req.params.assignmentId,
          agencyDriver: { agencyId: agency.id },
        },
      });
      if (!existing) return res.status(404).json({ error: "Assignment not found" });

      const updated = await prisma.driverAssignment.update({
        where: { id: existing.id },
        data: {
          ...(body.status !== undefined ? { status: body.status } : {}),
          ...(body.notes !== undefined ? { notes: body.notes } : {}),
          ...(body.startDate !== undefined ? { startDate: new Date(body.startDate) } : {}),
          ...(body.endDate !== undefined
            ? { endDate: body.endDate ? new Date(body.endDate) : null }
            : {}),
        },
        include: assignmentInclude,
      });

      if (body.status === "On Route") {
        await prisma.agencyDriver.update({
          where: { id: updated.agencyDriverId },
          data: { status: "On Tour" },
        });
      }

      res.json(serializeAssignment(updated));
    } catch (e) {
      next(e);
    }
  }
);

driversRouter.get("/:id", authRequired, requireRoles("AGENCY"), async (req, res, next) => {
  try {
    const agency = await getAgencyForUser(req.user!.id);
    if (!agency) return res.status(404).json({ error: "Agency not found" });

    const driver = await prisma.agencyDriver.findFirst({
      where: { id: req.params.id, agencyId: agency.id },
      include: {
        user: {
          include: {
            driverProfile: true,
          },
        },
        assignments: {
          where: { status: { not: "Cancelled" } },
          orderBy: { startDate: "desc" },
          include: assignmentInclude,
        },
      },
    });

    if (!driver) return res.status(404).json({ error: "Driver not found" });

    const profile = driver.user?.driverProfile;
    const metadata = (profile?.metadata as Record<string, unknown> | null) || {};

    res.json({
      id: driver.id,
      agencyId: driver.agencyId,
      userId: driver.userId,
      name: driver.name,
      phone: driver.phone,
      licenseNo: driver.licenseNo,
      vehicle: driver.vehicle,
      status: driver.status,
      createdAt: driver.createdAt,
      updatedAt: driver.updatedAt,
      hasLogin: Boolean(driver.userId),
      blockedDates: driver.userId ? parseBlockedDates(profile?.blockedDates) : [],
      profile: profile
        ? {
            bio: profile.bio,
            experience: typeof metadata.experience === "string" ? metadata.experience : "",
            languages: typeof metadata.languages === "string" ? metadata.languages : "",
            availabilityNotes:
              typeof metadata.availabilityNotes === "string" ? metadata.availabilityNotes : "",
          }
        : null,
      assignments: driver.assignments.map(serializeAssignment),
    });
  } catch (e) {
    next(e);
  }
});

driversRouter.patch("/:id", authRequired, requireRoles("AGENCY"), async (req, res, next) => {
  try {
    const agency = await getAgencyForUser(req.user!.id);
    if (!agency) return res.status(404).json({ error: "Agency not found" });

    const body = z
      .object({
        name: z.string().min(1).optional(),
        phone: z.string().optional(),
        licenseNo: z.string().optional(),
        vehicle: z.string().optional(),
        status: z.enum(DRIVER_STATUSES).optional(),
      })
      .parse(req.body);

    const existing = await prisma.agencyDriver.findFirst({
      where: { id: req.params.id, agencyId: agency.id },
    });
    if (!existing) return res.status(404).json({ error: "Driver not found" });

    const phone = body.phone ? toStoredPhone(body.phone) : undefined;

    const driver = await prisma.agencyDriver.update({
      where: { id: existing.id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.phone !== undefined ? { phone: phone || body.phone.trim() || null } : {}),
        ...(body.licenseNo !== undefined ? { licenseNo: body.licenseNo.trim() || null } : {}),
        ...(body.vehicle !== undefined ? { vehicle: body.vehicle.trim() || null } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
      },
    });

    if (body.status && driver.userId) {
      await prisma.driverProfile.updateMany({
        where: { userId: driver.userId },
        data: { status: body.status },
      });
    }

    res.json(driver);
  } catch (e) {
    next(e);
  }
});

driversRouter.get(
  "/:id/assignments",
  authRequired,
  requireRoles("AGENCY"),
  async (req, res, next) => {
    try {
      const agency = await getAgencyForUser(req.user!.id);
      if (!agency) return res.status(404).json({ error: "Agency not found" });

      const driver = await prisma.agencyDriver.findFirst({
        where: { id: req.params.id, agencyId: agency.id },
      });
      if (!driver) return res.status(404).json({ error: "Driver not found" });

      const assignments = await prisma.driverAssignment.findMany({
        where: { agencyDriverId: driver.id },
        orderBy: { startDate: "desc" },
        include: assignmentInclude,
      });

      res.json(assignments.map(serializeAssignment));
    } catch (e) {
      next(e);
    }
  }
);

driversRouter.post("/:id/assignments", authRequired, requireRoles("AGENCY"), async (req, res, next) => {
  try {
    const agency = await getAgencyForUser(req.user!.id);
    if (!agency) return res.status(404).json({ error: "Agency not found" });

    const body = z
      .object({
        title: z.string().min(1).optional(),
        inquiryId: z.string().optional(),
        tourId: z.string().optional(),
        startDate: z.string().datetime(),
        endDate: z.string().datetime().optional(),
        notes: z.string().optional(),
        status: z.enum(ASSIGNMENT_STATUSES).default("Scheduled"),
      })
      .parse(req.body);

    const driver = await prisma.agencyDriver.findFirst({
      where: { id: req.params.id, agencyId: agency.id },
      include: { user: { include: { driverProfile: true } } },
    });
    if (!driver) return res.status(404).json({ error: "Driver not found" });

    let inquiry: {
      id: string;
      agencyId: string;
      startDate: Date | null;
      endDate: Date | null;
      tour: { id: string; title: string } | null;
    } | null = null;

    if (body.inquiryId) {
      inquiry = await prisma.inquiry.findFirst({
        where: { id: body.inquiryId, agencyId: agency.id },
        include: { tour: { select: { id: true, title: true } } },
      });
      if (!inquiry) return res.status(400).json({ error: "Inquiry not found for this agency" });
    }

    if (body.tourId) {
      const tour = await prisma.tour.findFirst({
        where: { id: body.tourId, agencyId: agency.id },
      });
      if (!tour) return res.status(400).json({ error: "Tour not found for this agency" });
    }

    const startDate = new Date(body.startDate);
    const endDate = body.endDate
      ? new Date(body.endDate)
      : inquiry?.endDate
        ? new Date(inquiry.endDate)
        : null;

    const title =
      body.title?.trim() ||
      (inquiry?.tour?.title ? `${inquiry.tour.title} (${inquiry.id.slice(-6)})` : null) ||
      (body.tourId
        ? (
            await prisma.tour.findUnique({
              where: { id: body.tourId },
              select: { title: true },
            })
          )?.title
        : null) ||
      `Trip assignment`;

    const blocked = driver.userId
      ? parseBlockedDates(driver.user?.driverProfile?.blockedDates)
      : [];
    const blockedSet = new Set(blocked);
    const conflictDay = blocked.find((d) => {
      const day = new Date(`${d}T12:00:00`);
      return day >= startDate && (!endDate || day <= endDate);
    });
    if (conflictDay) {
      return res.status(409).json({
        error: `Driver marked unavailable on ${conflictDay}. Pick another date or driver.`,
      });
    }

    const assignment = await prisma.driverAssignment.create({
      data: {
        agencyDriverId: driver.id,
        inquiryId: body.inquiryId || inquiry?.id,
        tourId: body.tourId || inquiry?.tour?.id,
        title,
        startDate: inquiry?.startDate ? new Date(inquiry.startDate) : startDate,
        endDate: endDate,
        notes: body.notes?.trim(),
        status: body.status,
      },
      include: assignmentInclude,
    });

    res.status(201).json(serializeAssignment(assignment));
  } catch (e) {
    next(e);
  }
});

driversRouter.get(
  "/:id/blocked-dates",
  authRequired,
  requireRoles("AGENCY"),
  async (req, res, next) => {
    try {
      const agency = await getAgencyForUser(req.user!.id);
      if (!agency) return res.status(404).json({ error: "Agency not found" });

      const driver = await prisma.agencyDriver.findFirst({
        where: { id: req.params.id, agencyId: agency.id },
        include: {
          user: { include: { driverProfile: true } },
          assignments: {
            where: { status: { not: "Cancelled" } },
            select: { startDate: true, endDate: true, status: true },
          },
        },
      });

      if (!driver) return res.status(404).json({ error: "Driver not found" });

      res.json({
        driverId: driver.id,
        driverName: driver.name,
        blockedDates: driver.userId
          ? parseBlockedDates(driver.user?.driverProfile?.blockedDates)
          : [],
        assignedDates: assignmentDateKeys(driver.assignments),
        hasLogin: Boolean(driver.userId),
      });
    } catch (e) {
      next(e);
    }
  }
);

driversRouter.post("/", authRequired, requireRoles("AGENCY"), async (req, res, next) => {
  try {
    const agency = await getAgencyForUser(req.user!.id);
    if (!agency) return res.status(404).json({ error: "Agency not found" });

    const body = z
      .object({
        name: z.string().min(1, "Driver name is required"),
        phone: z.string().min(1, "Phone is required to create driver login"),
        licenseNo: z.string().optional(),
        vehicle: z.string().optional(),
        status: z.enum(DRIVER_STATUSES).default("Available"),
      })
      .parse(req.body);

    const phone = toStoredPhone(body.phone);
    if (!isValidInternationalPhone(phone)) {
      return res.status(400).json({
        error: "Invalid phone number. Include country code (e.g. +94771234567).",
      });
    }

    const licenseNo = body.licenseNo?.trim() || undefined;
    const vehicle = body.vehicle?.trim() || undefined;

    const result = await prisma.$transaction(async (tx) => {
      const duplicate = await tx.agencyDriver.findFirst({
        where: { agencyId: agency.id, phone },
      });
      if (duplicate) {
        throw Object.assign(new Error("This driver is already on your roster"), { status: 409 });
      }

      const existingUser = await tx.user.findUnique({
        where: { phone },
        include: { driverProfile: true, agencyDriver: true },
      });

      if (existingUser?.role && existingUser.role !== "DRIVER") {
        throw Object.assign(
          new Error("This phone is already used by another account type. Use a different number."),
          { status: 409 }
        );
      }

      if (
        existingUser?.agencyDriver &&
        existingUser.agencyDriver.agencyId !== agency.id
      ) {
        throw Object.assign(
          new Error("This driver is already linked to another agency"),
          { status: 409 }
        );
      }

      const { userId, created } = await ensureDriverUserAccount(tx, {
        name: existingUser?.name ?? body.name,
        phone: body.phone,
        licenseNo: existingUser?.driverProfile?.licenseNo ?? licenseNo,
        vehicle: existingUser?.driverProfile?.vehicle ?? vehicle,
        status: body.status,
      });

      const userWithProfile = await tx.user.findUnique({
        where: { id: userId },
        include: { driverProfile: true },
      });
      if (!userWithProfile) {
        throw Object.assign(new Error("Driver account could not be loaded"), { status: 500 });
      }

      const driver = await tx.agencyDriver.create({
        data: {
          agencyId: agency.id,
          userId,
          name: userWithProfile.name,
          phone,
          licenseNo: userWithProfile.driverProfile?.licenseNo ?? licenseNo ?? null,
          vehicle: userWithProfile.driverProfile?.vehicle ?? vehicle ?? null,
          status: body.status,
        },
      });

      return { driver, accountCreated: created };
    });

    res.status(201).json({
      ...result.driver,
      accountCreated: result.accountCreated,
      linkedToAccount: true,
      loginHint:
        "Driver can log in at /login with this phone and OTP — no separate signup needed.",
    });
  } catch (e) {
    next(e);
  }
});

driversRouter.patch("/:id/status", authRequired, requireRoles("AGENCY"), async (req, res, next) => {
  try {
    const agency = await getAgencyForUser(req.user!.id);
    if (!agency) return res.status(404).json({ error: "Agency not found" });

    const { status } = z.object({ status: z.enum(DRIVER_STATUSES) }).parse(req.body);

    const driver = await prisma.agencyDriver.update({
      where: { id: req.params.id, agencyId: agency.id },
      data: { status },
    });

    if (driver.userId) {
      await prisma.driverProfile.updateMany({
        where: { userId: driver.userId },
        data: { status: profileStatusFromAgency(status) },
      });
    }

    res.json(driver);
  } catch (e) {
    next(e);
  }
});
