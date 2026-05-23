import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authRequired, requireRoles } from "../middleware/auth.js";

export const driverRouter = Router();

driverRouter.get("/me", authRequired, requireRoles("DRIVER"), async (req, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.user!.id },
      include: { driverProfile: true },
    });
    res.json({ user: serializeDriverUser(user) });
  } catch (e) {
    next(e);
  }
});

driverRouter.patch("/profile", authRequired, requireRoles("DRIVER"), async (req, res, next) => {
  try {
    const body = z
      .object({
        status: z.enum(["available", "on_tour", "off_duty"]).optional(),
        licenseNo: z.string().optional(),
        vehicle: z.string().optional(),
        bio: z.string().optional(),
      })
      .parse(req.body);

    await prisma.driverProfile.upsert({
      where: { userId: req.user!.id },
      update: body,
      create: { userId: req.user!.id, ...body },
    });

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.user!.id },
      include: { driverProfile: true },
    });
    res.json({ user: serializeDriverUser(user) });
  } catch (e) {
    next(e);
  }
});

function serializeDriverUser(user: {
  id: string;
  phone: string;
  name: string;
  role: string;
  walletBalance: unknown;
  driverProfile: {
    licenseNo: string | null;
    vehicle: string | null;
    status: string;
    bio: string | null;
    articles: unknown;
  } | null;
}) {
  return {
    id: user.id,
    phone: user.phone,
    name: user.name,
    role: user.role,
    walletBalance: Number(user.walletBalance),
    driverProfile: user.driverProfile
      ? {
          licenseNo: user.driverProfile.licenseNo,
          vehicle: user.driverProfile.vehicle,
          status: user.driverProfile.status,
          bio: user.driverProfile.bio,
          articles: user.driverProfile.articles,
        }
      : null,
  };
}
