import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import type { UserRole } from "@prisma/client";
import { dashboardPathForRole } from "@tourpilot/shared";
import { prisma } from "../lib/prisma.js";
import { authRequired, signAccessToken } from "../middleware/auth.js";
import { createOtpChallenge, verifyOtpChallenge } from "../services/otp.js";
import { verifyPassword } from "../services/password.js";
import { linkAgencyDriverOnDriverSignup } from "../services/agencyDriverLink.js";
import { chargeLoginFee } from "../services/wallet.js";
import { isValidInternationalPhone, toStoredPhone } from "../utils/phone.js";
import { slugify } from "../utils/slug.js";

export const authRouter = Router();

const roleSchema = z.enum(["TOURIST", "AGENCY", "INFLUENCER", "DRIVER", "ADMIN"]);

authRouter.post("/register-request", async (req, res, next) => {
  try {
    const body = z
      .object({
        name: z.string().min(2),
        phone: z.string(),
        role: roleSchema,
        agencyName: z.string().optional(),
      })
      .parse(req.body);

    const phone = toStoredPhone(body.phone);
    if (!isValidInternationalPhone(phone)) {
      return res.status(400).json({
        error: "Invalid phone number. Include country code (e.g. +94771234567 or +14155552671).",
      });
    }

    if (body.role === "ADMIN") {
      return res.status(403).json({ error: "Admin accounts cannot be created via registration" });
    }

    const exists = await prisma.user.findUnique({ where: { phone } });
    if (exists) {
      if (exists.role === "DRIVER" || body.role === "DRIVER") {
        return res.status(409).json({
          error:
            "A driver account already exists for this phone. Use Login and enter OTP — no signup needed.",
          code: "ACCOUNT_EXISTS_LOGIN",
        });
      }
      return res.status(409).json({ error: "Account already exists for this phone" });
    }

    const result = await createOtpChallenge(phone, "register", {
      name: body.name,
      role: body.role,
      agencyName: body.agencyName,
    });

    res.json({
      challengeId: result.challengeId,
      otp: result.otp,
      bypassOtp: result.bypassOtp,
      message: "OTP sent (demo mode includes otp in response)",
    });
  } catch (e) {
    next(e);
  }
});

authRouter.post("/verify-registration", async (req, res, next) => {
  try {
    const body = z
      .object({
        challengeId: z.string(),
        phone: z.string(),
        otp: z.string().length(6),
      })
      .parse(req.body);

    const phone = toStoredPhone(body.phone);
    const payload = await verifyOtpChallenge(body.challengeId, phone, body.otp, "register");

    const name = String(payload.name || "User");
    const role = payload.role as UserRole;
    const agencyName = String(payload.agencyName || `${name} Tours`);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { phone, name, role },
      });

      if (role === "AGENCY") {
        let slug = slugify(agencyName);
        const taken = await tx.agency.findUnique({ where: { slug } });
        if (taken) slug = `${slug}-${created.id.slice(-4)}`;

        const agency = await tx.agency.create({
          data: {
            ownerId: created.id,
            name: agencyName,
            slug,
            status: "APPROVED",
            pageConfig: defaultAgencyPageConfig(agencyName),
            gallery: [],
          },
        });
        await tx.displaySettings.create({
          data: {
            agencyId: agency.id,
            sections: {
              enabled: {
                tours: true,
                showcase: true,
                reviews: true,
                gallery: true,
                offers: true,
                inquiry: true,
              },
              content: {
                heroHeadline: "Find your perfect trip experience.",
                packagesTitle: "Ready-Made Packages",
                packagesSubtitle:
                  "Curated routes with local guides, transport, and stays included.",
                ratingScore: "4.9",
                ratingSuffix: "/5",
                highlights: [
                  "Handcrafted itineraries for every traveler",
                  "Certified local guides and safe routes",
                  "Years of on-the-ground experience",
                ],
                ctaLabel: "Plan your trip",
                featuredImageUrl:
                  "https://images.unsplash.com/photo-1682687982501-1e58ab814714?auto=format&fit=crop&w=1200&q=80",
                featuredQuote:
                  "We expected an adventure. We found peace, wonder, and people who love what they do.",
                packages: [],
                offers: [],
              },
            },
            theme: {},
          },
        });
      }

      if (role === "TOURIST") {
        await tx.touristProfile.create({ data: { userId: created.id } });
      }
      if (role === "INFLUENCER") {
        await tx.influencerProfile.create({ data: { userId: created.id } });
      }
      if (role === "DRIVER") {
        await tx.driverProfile.create({
          data: {
            userId: created.id,
            status: "available",
            blockedDates: [],
            metadata: {},
          },
        });
        await linkAgencyDriverOnDriverSignup(tx, created.id, phone);
      }

      return created;
    });

    const token = signAccessToken({ id: user.id, phone: user.phone, role: user.role });

    res.status(201).json({
      token,
      user: serializeUser(user),
      redirectTo: dashboardPathForRole(user.role),
    });
  } catch (e) {
    next(e);
  }
});

/** Start login: admin → password step; all other roles → OTP challenge. */
async function handleLoginStart(req: Request, res: Response, next: NextFunction) {
  try {
    const { phone: raw } = z.object({ phone: z.string() }).parse(req.body);
    const phone = toStoredPhone(raw);

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      return res.status(404).json({
        error: "No account found for this phone. Create a tourist account to get started.",
        code: "USER_NOT_FOUND",
      });
    }

    if (user.role === "ADMIN") {
      if (!user.passwordHash) {
        return res.status(503).json({ error: "Admin password is not configured" });
      }
      return res.json({
        authMethod: "password",
        role: user.role,
        redirectTo: dashboardPathForRole(user.role),
      });
    }

    const result = await createOtpChallenge(phone, "login");
    res.json({
      authMethod: "otp",
      challengeId: result.challengeId,
      otp: result.otp,
      bypassOtp: result.bypassOtp,
      role: user.role,
      walletBalance: Number(user.walletBalance),
      redirectTo: dashboardPathForRole(user.role),
    });
  } catch (e) {
    next(e);
  }
}

authRouter.post("/login-start", handleLoginStart);
authRouter.post("/send-otp", handleLoginStart);

authRouter.post("/login-password", async (req, res, next) => {
  try {
    const body = z
      .object({
        phone: z.string(),
        password: z.string().min(1),
      })
      .parse(req.body);

    const phone = toStoredPhone(body.phone);
    const user = await prisma.user.findUnique({ where: { phone } });

    if (!user || user.role !== "ADMIN") {
      return res.status(401).json({ error: "Invalid phone or password" });
    }
    if (!user.passwordHash) {
      return res.status(503).json({ error: "Admin password is not configured" });
    }

    const valid = await verifyPassword(body.password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid phone or password" });
    }

    const token = signAccessToken({ id: user.id, phone: user.phone, role: user.role });

    res.json({
      token,
      user: serializeUser(user),
      redirectTo: dashboardPathForRole(user.role),
    });
  } catch (e) {
    next(e);
  }
});

authRouter.post("/verify-otp", async (req, res, next) => {
  try {
    const body = z
      .object({
        challengeId: z.string(),
        phone: z.string(),
        otp: z.string().length(6),
      })
      .parse(req.body);

    const phone = toStoredPhone(body.phone);
    await verifyOtpChallenge(body.challengeId, phone, body.otp, "login");

    const user = await prisma.user.findUniqueOrThrow({ where: { phone } });
    if (user.role === "ADMIN") {
      return res.status(403).json({ error: "Admin accounts must log in with a password" });
    }

    const feeResult = await chargeLoginFee(user.id, user.role);

    const token = signAccessToken({ id: user.id, phone: user.phone, role: user.role });
    const refreshed = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

    res.json({
      token,
      user: serializeUser(refreshed),
      loginFeeCharged: feeResult.charged,
      redirectTo: dashboardPathForRole(user.role),
    });
  } catch (e) {
    next(e);
  }
});

authRouter.get("/me", authRequired, async (req, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.user!.id },
      include: {
        agency: true,
        touristProfile: true,
        influencerProfile: { include: { codes: true } },
        driverProfile: true,
        agencyDriver: { include: { agency: { select: { id: true, name: true, slug: true } } } },
      },
    });
    res.json({ user: serializeUser(user) });
  } catch (e) {
    next(e);
  }
});

function serializeUser(user: {
  id: string;
  phone: string;
  name: string;
  role: UserRole;
  email: string | null;
  avatarUrl: string | null;
  walletBalance: unknown;
  touristProfile?: { loyaltyPoints: number } | null;
  agency?: { id: string; name: string; slug: string } | null;
  agencyDriver?: {
    id: string;
    agencyId: string;
    status: string;
    agency: { id: string; name: string; slug: string };
  } | null;
}) {
  return {
    id: user.id,
    phone: user.phone,
    name: user.name,
    role: user.role,
    email: user.email,
    avatarUrl: user.avatarUrl,
    walletBalance: Number(user.walletBalance),
    touristProfile: user.touristProfile
      ? { loyaltyPoints: user.touristProfile.loyaltyPoints }
      : null,
    agency: user.agency ?? null,
    agencyDriver: user.agencyDriver
      ? {
          id: user.agencyDriver.id,
          agencyId: user.agencyDriver.agencyId,
          agencyName: user.agencyDriver.agency.name,
          agencySlug: user.agencyDriver.agency.slug,
          status: user.agencyDriver.status,
        }
      : null,
  };
}

function defaultAgencyPageConfig(name: string) {
  return {
    sections: [
      { type: "hero", title: name, subtitle: "Curated Sri Lanka experiences" },
      { type: "gallery", images: [] },
      { type: "tours", title: "Ready-made tours" },
      { type: "reviews", title: "Traveler reviews" },
      { type: "cta", title: "Plan your trip", button: "Send inquiry" },
    ],
  };
}
