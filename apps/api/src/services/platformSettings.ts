import type { UserRole } from "@prisma/client";
import { DEFAULT_LOGIN_FEE_LKR } from "@tourpilot/shared";
import { prisma } from "../lib/prisma.js";
import { config } from "../lib/config.js";

export type PlatformSettingsView = {
  loginFees: Record<UserRole, number>;
  inquiryExpiryDays: number;
  webAppUrl: string;
  emailFrom: string;
  walletTopupMinLkr: number;
  walletTopupMaxLkr: number | null;
  updatedAt: string | null;
};

const SETTINGS_ID = "default";

let cache: { at: number; value: PlatformSettingsView } | null = null;
const CACHE_MS = 15_000;

function serialize(row: {
  loginFeeTourist: { toString(): string } | number;
  loginFeeAgency: { toString(): string } | number;
  loginFeeInfluencer: { toString(): string } | number;
  loginFeeDriver: { toString(): string } | number;
  loginFeeAdmin: { toString(): string } | number;
  inquiryExpiryDays: number;
  webAppUrl: string | null;
  emailFrom: string | null;
  walletTopupMinLkr: { toString(): string } | number;
  walletTopupMaxLkr: { toString(): string } | number | null;
  updatedAt: Date;
}): PlatformSettingsView {
  return {
    loginFees: {
      TOURIST: Number(row.loginFeeTourist),
      AGENCY: Number(row.loginFeeAgency),
      INFLUENCER: Number(row.loginFeeInfluencer),
      DRIVER: Number(row.loginFeeDriver),
      ADMIN: Number(row.loginFeeAdmin),
    },
    inquiryExpiryDays: row.inquiryExpiryDays,
    webAppUrl: (row.webAppUrl?.trim() || config.webAppUrl).replace(/\/$/, ""),
    emailFrom: row.emailFrom?.trim() || config.email.from,
    walletTopupMinLkr: Number(row.walletTopupMinLkr),
    walletTopupMaxLkr:
      row.walletTopupMaxLkr == null ? null : Number(row.walletTopupMaxLkr),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function defaultsView(): PlatformSettingsView {
  return {
    loginFees: { ...DEFAULT_LOGIN_FEE_LKR },
    inquiryExpiryDays: config.inquiryExpiryDays,
    webAppUrl: config.webAppUrl,
    emailFrom: config.email.from,
    walletTopupMinLkr: 100,
    walletTopupMaxLkr: null,
    updatedAt: null,
  };
}

export function invalidatePlatformSettingsCache() {
  cache = null;
}

export async function ensurePlatformSettings() {
  return prisma.platformSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: {
      id: SETTINGS_ID,
      loginFeeTourist: DEFAULT_LOGIN_FEE_LKR.TOURIST,
      loginFeeAgency: DEFAULT_LOGIN_FEE_LKR.AGENCY,
      loginFeeInfluencer: DEFAULT_LOGIN_FEE_LKR.INFLUENCER,
      loginFeeDriver: DEFAULT_LOGIN_FEE_LKR.DRIVER,
      loginFeeAdmin: DEFAULT_LOGIN_FEE_LKR.ADMIN,
      inquiryExpiryDays: config.inquiryExpiryDays,
      webAppUrl: null,
      emailFrom: null,
      walletTopupMinLkr: 100,
      walletTopupMaxLkr: null,
    },
  });
}

export async function getPlatformSettings(opts?: {
  bypassCache?: boolean;
}): Promise<PlatformSettingsView> {
  if (!opts?.bypassCache && cache && Date.now() - cache.at < CACHE_MS) {
    return cache.value;
  }
  try {
    const row = await ensurePlatformSettings();
    const value = serialize(row);
    cache = { at: Date.now(), value };
    return value;
  } catch {
    return defaultsView();
  }
}

export type PlatformSettingsPatch = {
  loginFees?: Partial<Record<UserRole, number>>;
  inquiryExpiryDays?: number;
  webAppUrl?: string | null;
  emailFrom?: string | null;
  walletTopupMinLkr?: number;
  walletTopupMaxLkr?: number | null;
};

export async function updatePlatformSettings(patch: PlatformSettingsPatch) {
  await ensurePlatformSettings();
  const data: Record<string, unknown> = {};
  if (patch.loginFees) {
    if (patch.loginFees.TOURIST !== undefined) data.loginFeeTourist = patch.loginFees.TOURIST;
    if (patch.loginFees.AGENCY !== undefined) data.loginFeeAgency = patch.loginFees.AGENCY;
    if (patch.loginFees.INFLUENCER !== undefined) {
      data.loginFeeInfluencer = patch.loginFees.INFLUENCER;
    }
    if (patch.loginFees.DRIVER !== undefined) data.loginFeeDriver = patch.loginFees.DRIVER;
    if (patch.loginFees.ADMIN !== undefined) data.loginFeeAdmin = patch.loginFees.ADMIN;
  }
  if (patch.inquiryExpiryDays !== undefined) {
    data.inquiryExpiryDays = patch.inquiryExpiryDays;
  }
  if (patch.webAppUrl !== undefined) {
    data.webAppUrl = patch.webAppUrl?.trim() ? patch.webAppUrl.trim().replace(/\/$/, "") : null;
  }
  if (patch.emailFrom !== undefined) {
    data.emailFrom = patch.emailFrom?.trim() || null;
  }
  if (patch.walletTopupMinLkr !== undefined) {
    data.walletTopupMinLkr = patch.walletTopupMinLkr;
  }
  if (patch.walletTopupMaxLkr !== undefined) {
    data.walletTopupMaxLkr = patch.walletTopupMaxLkr;
  }

  const row = await prisma.platformSettings.update({
    where: { id: SETTINGS_ID },
    data,
  });
  invalidatePlatformSettingsCache();
  return serialize(row);
}

/** Per-user override wins; otherwise role default from platform settings. */
export async function resolveLoginFeeForUser(user: {
  role: UserRole;
  loginFeeLkr: { toString(): string } | number | null;
}): Promise<number> {
  if (user.loginFeeLkr != null) return Math.max(0, Number(user.loginFeeLkr));
  const settings = await getPlatformSettings();
  return Math.max(0, settings.loginFees[user.role] ?? DEFAULT_LOGIN_FEE_LKR[user.role] ?? 0);
}
