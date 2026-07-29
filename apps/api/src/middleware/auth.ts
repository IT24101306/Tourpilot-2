import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../lib/config.js";
import { prisma } from "../lib/prisma.js";
import { getPlatformSettings } from "../services/platformSettings.js";
import {
  buildTrialStatus,
  formatSessionInactivity,
  isTrialExpiredUnpaid,
  resolveSessionInactivityMinutes,
} from "@tourpilot/shared";
import type { UserRole } from "@prisma/client";
import { trialExemptPath } from "../services/trial.js";

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

/**
 * Background polls that must not refresh lastActiveAt — otherwise idle timeout
 * never fires while a tab is open. Chat sync/typing are intentionally NOT
 * passive: they only run while the user is in a chat room, and that counts as
 * active use. Closing chat (confirmed exit) stops those polls so idle can apply.
 */
function isPassiveActivityPath(req: Request): boolean {
  const raw = `${req.originalUrl || ""}${req.path || ""}`.toLowerCase();
  const pathOnly = raw.split("?")[0] || "";
  if (pathOnly.includes("/notifications/")) return true;
  if (pathOnly.endsWith("/auth/me") || pathOnly.includes("/auth/me")) return true;
  if (pathOnly.includes("/fx/rates")) return true;
  return false;
}

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
        trialEndsAt: true,
        packageActivatedAt: true,
        selectedPackageId: true,
        selectedPackageName: true,
        selectedPackagePriceLkr: true,
        selectedPackagePriceLabel: true,
        selectedPackageBilling: true,
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

    const expiredUnpaid = isTrialExpiredUnpaid({
      trialEndsAt: user.trialEndsAt,
      packageActivatedAt: user.packageActivatedAt,
    });
    if (expiredUnpaid && !trialExemptPath(req.originalUrl || req.path)) {
      const trial = buildTrialStatus(user);
      return res.status(402).json({
        error: `Your free trial has ended. Activate ${trial.packageName || "your package"} (${trial.priceLabel || "selected plan"}) to continue.`,
        code: "TRIAL_EXPIRED",
        trial,
      });
    }

    req.user = { id: user.id, phone: user.phone, role: user.role };

    const passive = isPassiveActivityPath(req);
    // Always stamp a missing lastActiveAt (even on passive polls) so the idle
    // clock can start; thereafter only real user requests refresh it.
    const shouldTouch =
      !user.lastActiveAt ||
      (!passive && Date.now() - user.lastActiveAt.getTime() > ACTIVITY_TOUCH_MS);
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
  const minutes = resolveSessionInactivityMinutes({
    agencyMinutes: agency.sessionInactivityMinutes,
    agencyHours: agency.sessionInactivityHours,
    platformMinutes: settings.sessionInactivityMinutes,
    platformHours: settings.sessionInactivityHours,
  });

  if (!lastActiveAt) return null;

  const idleMs = Date.now() - lastActiveAt.getTime();
  if (idleMs <= minutes * 60 * 1000) return null;

  return {
    error: `Session expired after ${formatSessionInactivity(minutes)} of inactivity. Please log in again (login fee applies).`,
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

/** Agency owned by this user (not staff membership). */
export async function getOwnedAgency(userId: string) {
  return prisma.agency.findUnique({ where: { ownerId: userId } });
}

/** Call after a successful login so the inactivity window starts fresh. */
export async function touchUserActivity(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { lastActiveAt: new Date() },
  });
}
