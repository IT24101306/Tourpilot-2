import type { UserRole } from "@prisma/client";
import { LOGIN_FEE_LKR, type UserRole as SharedRole } from "@tourpilot/shared";
import { config } from "../lib/config.js";
import { prisma } from "../lib/prisma.js";
import { asJson } from "../utils/json.js";

export const PLATFORM_SETTINGS_ID = "default";

export type LoginFeesByRole = Record<UserRole, number>;

export type EmailTemplateOverride = {
  subject?: string;
  body?: string;
};

export type EmailTemplatesMap = Record<string, EmailTemplateOverride>;

export type PlatformSettingsView = {
  loginFees: LoginFeesByRole;
  inquiryExpiryDays: number;
  webAppUrl: string;
  emailFrom: string;
  walletTopupMinLkr: number;
  walletTopupMaxLkr: number | null;
  /** Default idle hours for agencies with session inactivity package. */
  sessionInactivityHours: number;
  emailTemplates: EmailTemplatesMap;
  updatedAt: string | null;
};

const ROLES: UserRole[] = ["TOURIST", "AGENCY", "INFLUENCER", "DRIVER", "ADMIN"];

export const EMAIL_TEMPLATE_KEYS = [
  "inquiryCreated",
  "proposalSent",
  "inquiryStatus",
  "inquiryExpired",
  "commissionPaid",
  "agencyRejection",
] as const;

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

function normalizeEmailTemplates(raw: unknown): EmailTemplatesMap {
  if (!raw || typeof raw !== "object") return {};
  const out: EmailTemplatesMap = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const v = value as Record<string, unknown>;
    const subject = typeof v.subject === "string" ? v.subject : undefined;
    const body = typeof v.body === "string" ? v.body : undefined;
    if (subject || body) out[key] = { subject, body };
  }
  return out;
}

function viewFromRow(row: {
  loginFees: unknown;
  inquiryExpiryDays: number;
  webAppUrl: string | null;
  emailFrom: string | null;
  walletTopupMinLkr: number;
  walletTopupMaxLkr: number | null;
  sessionInactivityHours?: number;
  emailTemplates: unknown;
  updatedAt: Date;
} | null): PlatformSettingsView {
  return {
    loginFees: normalizeLoginFees(row?.loginFees),
    inquiryExpiryDays: row?.inquiryExpiryDays ?? config.inquiryExpiryDays ?? 14,
    webAppUrl: row?.webAppUrl?.trim() || config.webAppUrl || "",
    emailFrom: row?.emailFrom?.trim() || config.email.from || "",
    walletTopupMinLkr: row?.walletTopupMinLkr ?? 100,
    walletTopupMaxLkr: row?.walletTopupMaxLkr ?? null,
    sessionInactivityHours: Math.max(1, Math.min(168, row?.sessionInactivityHours ?? 3)),
    emailTemplates: normalizeEmailTemplates(row?.emailTemplates),
    updatedAt: row?.updatedAt?.toISOString() ?? null,
  };
}

export async function getPlatformSettings(): Promise<PlatformSettingsView> {
  const row = await prisma.platformSettings.findUnique({
    where: { id: PLATFORM_SETTINGS_ID },
  });
  return viewFromRow(row);
}

export async function updatePlatformSettings(input: {
  loginFees?: Partial<Record<SharedRole, number>>;
  inquiryExpiryDays?: number;
  webAppUrl?: string | null;
  emailFrom?: string | null;
  walletTopupMinLkr?: number;
  walletTopupMaxLkr?: number | null;
  sessionInactivityHours?: number;
  emailTemplates?: EmailTemplatesMap;
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

  const inquiryExpiryDays =
    input.inquiryExpiryDays !== undefined
      ? Math.max(1, Math.min(365, Math.round(input.inquiryExpiryDays)))
      : current.inquiryExpiryDays;

  const walletTopupMinLkr =
    input.walletTopupMinLkr !== undefined
      ? Math.max(1, Math.round(input.walletTopupMinLkr))
      : current.walletTopupMinLkr;

  let walletTopupMaxLkr =
    input.walletTopupMaxLkr !== undefined
      ? input.walletTopupMaxLkr == null
        ? null
        : Math.max(1, Math.round(input.walletTopupMaxLkr))
      : current.walletTopupMaxLkr;

  if (walletTopupMaxLkr != null && walletTopupMaxLkr < walletTopupMinLkr) {
    const err = new Error("Wallet top-up max must be >= min");
    (err as Error & { status: number }).status = 400;
    throw err;
  }

  const sessionInactivityHours =
    input.sessionInactivityHours !== undefined
      ? Math.max(1, Math.min(168, Math.round(input.sessionInactivityHours)))
      : current.sessionInactivityHours;

  const emailTemplates =
    input.emailTemplates !== undefined
      ? normalizeEmailTemplates(input.emailTemplates)
      : current.emailTemplates;

  const webAppUrl =
    input.webAppUrl !== undefined
      ? input.webAppUrl?.trim() || null
      : current.webAppUrl || null;
  const emailFrom =
    input.emailFrom !== undefined
      ? input.emailFrom?.trim() || null
      : current.emailFrom || null;

  const row = await prisma.platformSettings.upsert({
    where: { id: PLATFORM_SETTINGS_ID },
    create: {
      id: PLATFORM_SETTINGS_ID,
      loginFees: asJson(loginFees),
      inquiryExpiryDays,
      webAppUrl,
      emailFrom,
      walletTopupMinLkr,
      walletTopupMaxLkr,
      sessionInactivityHours,
      emailTemplates: asJson(emailTemplates),
    },
    update: {
      loginFees: asJson(loginFees),
      inquiryExpiryDays,
      webAppUrl,
      emailFrom,
      walletTopupMinLkr,
      walletTopupMaxLkr,
      sessionInactivityHours,
      emailTemplates: asJson(emailTemplates),
    },
  });

  return viewFromRow(row);
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

export async function resolveWalletTopupBounds(): Promise<{
  min: number;
  max: number | null;
}> {
  const s = await getPlatformSettings();
  return { min: s.walletTopupMinLkr, max: s.walletTopupMaxLkr };
}

/** Apply {{key}} placeholders in admin-edited email templates. */
export function applyEmailTemplate(
  templates: EmailTemplatesMap,
  key: string,
  defaults: { subject: string; body: string },
  vars: Record<string, string>
): { subject: string; body: string } {
  const override = templates[key];
  let subject = override?.subject?.trim() || defaults.subject;
  let body = override?.body?.trim() || defaults.body;
  for (const [k, v] of Object.entries(vars)) {
    const token = new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, "g");
    subject = subject.replace(token, v);
    body = body.replace(token, v);
  }
  return { subject, body };
}
