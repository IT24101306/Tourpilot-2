import type { UserRole } from "@prisma/client";
import { LOGIN_FEE_LKR, type UserRole as SharedRole } from "@tourpilot/shared";
import { prisma } from "../lib/prisma.js";
import { asJson } from "../utils/json.js";

export const PLATFORM_SETTINGS_ID = "default";

export type LoginFeesByRole = Record<UserRole, number>;

export type PlatformSettingsView = {
  loginFees: LoginFeesByRole;
  updatedAt: string | null;
};

const ROLES: UserRole[] = ["TOURIST", "AGENCY", "INFLUENCER", "DRIVER", "ADMIN"];

export function defaultLoginFees(): LoginFeesByRole {
  return {
    TOURIST: LOGIN_FEE_LKR.TOURIST,
    AGENCY: LOGIN_FEE_LKR.AGENCY,
    INFLUENCER: LOGIN_FEE_LKR.INFLUENCER,
    DRIVER: LOGIN_FEE_LKR.DRIVER,
    ADMIN: LOGIN_FEE_LKR.ADMIN,
  };
}

function normalizeLoginFees(raw: unknown): LoginFeesByRole {
  const defaults = defaultLoginFees();
  if (!raw || typeof raw !== "object") return defaults;
  const obj = raw as Record<string, unknown>;
  const out = { ...defaults };
  for (const role of ROLES) {
    const n = Number(obj[role]);
    if (Number.isFinite(n) && n >= 0) out[role] = Math.round(n);
  }
  return out;
}

export async function getPlatformSettings(): Promise<PlatformSettingsView> {
  const row = await prisma.platformSettings.findUnique({
    where: { id: PLATFORM_SETTINGS_ID },
  });
  if (!row) {
    return { loginFees: defaultLoginFees(), updatedAt: null };
  }
  return {
    loginFees: normalizeLoginFees(row.loginFees),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function updatePlatformSettings(input: {
  loginFees?: Partial<Record<SharedRole, number>>;
}): Promise<PlatformSettingsView> {
  const current = await getPlatformSettings();
  const loginFees = { ...current.loginFees };
  if (input.loginFees) {
    for (const role of ROLES) {
      const n = input.loginFees[role as SharedRole];
      if (n === undefined) continue;
      const value = Number(n);
      if (!Number.isFinite(value) || value < 0) {
        const err = new Error(`Invalid login fee for ${role}`);
        (err as Error & { status: number }).status = 400;
        throw err;
      }
      loginFees[role] = Math.round(value);
    }
  }

  const row = await prisma.platformSettings.upsert({
    where: { id: PLATFORM_SETTINGS_ID },
    create: {
      id: PLATFORM_SETTINGS_ID,
      loginFees: asJson(loginFees),
    },
    update: {
      loginFees: asJson(loginFees),
    },
  });

  return {
    loginFees: normalizeLoginFees(row.loginFees),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Effective fee: per-user override → platform role fee → shared defaults. */
export async function resolveLoginFeeForUser(user: {
  role: UserRole;
  loginFeeLkr?: unknown;
}): Promise<number> {
  if (user.loginFeeLkr != null) {
    const custom = Number(user.loginFeeLkr);
    if (Number.isFinite(custom) && custom >= 0) return Math.round(custom);
  }
  const settings = await getPlatformSettings();
  return settings.loginFees[user.role] ?? 0;
}
