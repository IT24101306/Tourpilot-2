import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { normalizeBlockedDates, parseBlockedDates } from "../lib/driverBlockedDates.js";
import { authRequired, getAgencyForUser, requireRoles } from "../middleware/auth.js";
import { asJson } from "../utils/json.js";
import { toStoredPhone } from "../utils/phone.js";

export const driversRouter = Router();

const DRIVER_STATUSES = ["Available", "On Tour", "Off Duty"] as const;

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
        },
      });

      if (!driver) return res.status(404).json({ error: "Driver not found" });

      res.json({
        driverId: driver.id,
        driverName: driver.name,
        blockedDates: driver.userId
          ? parseBlockedDates(driver.user?.driverProfile?.blockedDates)
          : [],
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
        phone: z.string().optional(),
        licenseNo: z.string().optional(),
        vehicle: z.string().optional(),
        status: z.enum(DRIVER_STATUSES).default("Available"),
      })
      .parse(req.body);

    const phone = body.phone ? toStoredPhone(body.phone) : undefined;

    let linkedUserId: string | undefined;
    if (phone) {
      const user = await prisma.user.findUnique({ where: { phone } });
      if (user?.role === "DRIVER") {
        const existing = await prisma.agencyDriver.findUnique({ where: { userId: user.id } });
        if (existing && existing.agencyId !== agency.id) {
          return res.status(409).json({ error: "This driver is already registered to another agency" });
        }
        linkedUserId = user.id;
      }
    }

    const driver = await prisma.agencyDriver.create({
      data: {
        agencyId: agency.id,
        userId: linkedUserId,
        name: body.name.trim(),
        phone: phone || body.phone?.trim() || undefined,
        licenseNo: body.licenseNo?.trim() || undefined,
        vehicle: body.vehicle?.trim() || undefined,
        status: body.status,
      },
    });

    res.status(201).json(driver);
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
        data: { status },
      });
    }

    res.json(driver);
  } catch (e) {
    next(e);
  }
});
