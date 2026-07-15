import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../lib/config.js";
import { prisma } from "../lib/prisma.js";
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
      select: { id: true, phone: true, role: true, isActive: true },
    });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Account disabled" });
    }
    req.user = { id: user.id, phone: user.phone, role: user.role };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
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
