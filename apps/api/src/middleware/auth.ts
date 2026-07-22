import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../lib/config.js";
import { prisma } from "../lib/prisma.js";
import { getPlatformSettings } from "../services/platformSettings.js";
import type { UserRole } from "@prisma/client";

export type AuthUser = {
  id: string;
  phone: string;
  role: UserRole;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signAccessToken(user: AuthUser) {
  return jwt.sign({ sub: user.id, phone: user.phone, role: user.role }, config.jwtSecret, {
    expiresIn: "7d",
  });
}

const ACTIVITY_TOUCH_MS = 60_000;

export async function authRequired(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret) as {
      sub: string;
      phone: string;
      role: UserRole;
    };
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        phone: true,
        role: true,
        isActive: true,
        lastActiveAt: true,
      },
    });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Account disabled" });
    }

    if (user.role === "AGENCY") {
      const inactive = await enforceAgencySessionInactivity(user.id, user.lastActiveAt);
      if (inactive) {
        return res.status(401).json(inactive);
      }
    }

    req.user = { id: user.id, phone: user.phone, role: user.role };

    const shouldTouch =
      !user.lastActiveAt || Date.now() - user.lastActiveAt.getTime() > ACTIVITY_TOUCH_MS;
    if (shouldTouch) {
      void prisma.user
        .update({ where: { id: user.id }, data: { lastActiveAt: new Date() } })
        .catch(() => undefined);
    }

    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

async function enforceAgencySessionInactivity(
  userId: string,
  lastActiveAt: Date | null
): Promise<{ error: string; code: string } | null> {
  const agency = await getAgencyForUser(userId);
  if (!agency?.featureSessionInactivityTimeout) return null;

  const settings = await getPlatformSettings();
  const hours = Math.max(
    1,
    Math.min(168, agency.sessionInactivityHours ?? settings.sessionInactivityHours ?? 3)
  );

  if (!lastActiveAt) return null;

  const idleMs = Date.now() - lastActiveAt.getTime();
  if (idleMs <= hours * 60 * 60 * 1000) return null;

  return {
    error: `Session expired after ${hours} hour${hours === 1 ? "" : "s"} of inactivity. Please log in again (login fee applies).`,
    code: "SESSION_INACTIVE",
  };
}

export function requireRoles(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

export async function getAgencyForUser(userId: string) {
  const owned = await prisma.agency.findUnique({ where: { ownerId: userId } });
  if (owned) return owned;
  const staff = await prisma.agencyStaff.findFirst({
    where: { userId },
    include: { agency: true },
  });
  return staff?.agency ?? null;
}

/** Call after a successful login so the inactivity window starts fresh. */
export async function touchUserActivity(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { lastActiveAt: new Date() },
  });
}
