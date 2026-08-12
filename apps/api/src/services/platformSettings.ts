import type { UserRole } from "@prisma/client";
import {
  DEFAULT_SUPPORT_CONTENT,
  LOGIN_FEE_LKR,
  SESSION_INACTIVITY_DEFAULT_MINUTES,
  clampSessionInactivityMinutes,
  parseSupportContent,
  resolveSessionInactivityMinutes,
  type SupportContent,
  type UserRole as SharedRole,
} from "@tourpilot/shared";
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

export type AgencyReferralSettings = {
  enabled: boolean;
  cap: number;
  loginFeePct: number;
  rewardMonths: number;
};

export type PlatformSettingsView = {
  loginFees: LoginFeesByRole;
  inquiryExpiryDays: number;
  webAppUrl: string;
  emailFrom: string;
  walletTopupMinLkr: number;
  walletTopupMaxLkr: number | null;
  /** Resolved idle timeout in minutes (preferred). */
  sessionInactivityMinutes: number;
  /** Legacy hours view (rounded up) for older clients. */
  sessionInactivityHours: number;
  emailTemplates: EmailTemplatesMap;
  supportContent: SupportContent;
  agencyReferralEnabled: boolean;
  agencyReferralCap: number;
  agencyReferralLoginFeePct: number;
  agencyReferralRewardMonths: number;
  updatedAt: string | null;
};

export const DEFAULT_AGENCY_REFERRAL: AgencyReferralSettings = {
  enabled: true,
  cap: 5,
  loginFeePct: 25,
  rewardMonths: 12,
};

const ROLES: UserRole[] = ["TOURIST", "AGENCY", "INFLUENCER", "DRIVER", "ADMIN"];

export const EMAIL_TEMPLATE_KEYS = [
  "otp",
  "welcome",
  "tripMessage",
  "agencyApproved",
  "agencyRejection",
  "walletReceipt",
  "inquiryCreated",
  "proposalSent",
  "inquiryStatus",
  "inquiryExpired",
  "commissionPaid",
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

function clampReferralCap(n: number) {
  return Math.max(1, Math.min(50, Math.round(n)));
}
function clampReferralPct(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}
function clampReferralMonths(n: number) {
  return Math.max(1, Math.min(60, Math.round(n)));
}

function viewFromRow(row: {
  loginFees: unknown;
  inquiryExpiryDays: number;
  webAppUrl: string | null;
  emailFrom: string | null;
  walletTopupMinLkr: number;
  walletTopupMaxLkr: number | null;
  sessionInactivityHours?: number | null;
  sessionInactivityMinutes?: number | null;
  emailTemplates: unknown;
  supportContent?: unknown;
  agencyReferralEnabled?: boolean | null;
  agencyReferralCap?: number | null;
  agencyReferralLoginFeePct?: number | null;
  agencyReferralRewardMonths?: number | null;
  updatedAt: Date;
} | null): PlatformSettingsView {
  const sessionInactivityMinutes = resolveSessionInactivityMinutes({
    platformMinutes: row?.sessionInactivityMinutes,
    platformHours: row?.sessionInactivityHours,
  });
  return {
    loginFees: normalizeLoginFees(row?.loginFees),
    inquiryExpiryDays: row?.inquiryExpiryDays ?? config.inquiryExpiryDays ?? 7,
    webAppUrl: row?.webAppUrl?.trim() || config.webAppUrl || "",
    emailFrom: row?.emailFrom?.trim() || config.email.from || "",
    walletTopupMinLkr: row?.walletTopupMinLkr ?? 100,
    walletTopupMaxLkr: row?.walletTopupMaxLkr ?? null,
    sessionInactivityMinutes,
    sessionInactivityHours: Math.max(1, Math.ceil(sessionInactivityMinutes / 60)),
    emailTemplates: normalizeEmailTemplates(row?.emailTemplates),
    supportContent: parseSupportContent(row?.supportContent ?? DEFAULT_SUPPORT_CONTENT),
    agencyReferralEnabled: row?.agencyReferralEnabled ?? DEFAULT_AGENCY_REFERRAL.enabled,
    agencyReferralCap:
      row?.agencyReferralCap != null
        ? clampReferralCap(row.agencyReferralCap)
        : DEFAULT_AGENCY_REFERRAL.cap,
    agencyReferralLoginFeePct:
      row?.agencyReferralLoginFeePct != null
        ? clampReferralPct(row.agencyReferralLoginFeePct)
        : DEFAULT_AGENCY_REFERRAL.loginFeePct,
    agencyReferralRewardMonths:
      row?.agencyReferralRewardMonths != null
        ? clampReferralMonths(row.agencyReferralRewardMonths)
        : DEFAULT_AGENCY_REFERRAL.rewardMonths,
    updatedAt: row?.updatedAt?.toISOString() ?? null,
  };
}

export async function getPlatformSettings(): Promise<PlatformSettingsView> {
  const row = await prisma.platformSettings.findUnique({
    where: { id: PLATFORM_SETTINGS_ID },
  });
  return viewFromRow(row);
}

export async function getSupportContent(): Promise<SupportContent> {
  const settings = await getPlatformSettings();
  return settings.supportContent;
}

export async function getAgencyReferralSettings(): Promise<AgencyReferralSettings> {
  const s = await getPlatformSettings();
  return {
    enabled: s.agencyReferralEnabled,
    cap: s.agencyReferralCap,
    loginFeePct: s.agencyReferralLoginFeePct,
    rewardMonths: s.agencyReferralRewardMonths,
  };
}

export async function updatePlatformSettings(input: {
  loginFees?: Partial<Record<SharedRole, number>>;
  inquiryExpiryDays?: number;
  webAppUrl?: string | null;
  emailFrom?: string | null;
  walletTopupMinLkr?: number;
  walletTopupMaxLkr?: number | null;
  /** Preferred: idle timeout in minutes (1 … 10080). */
  sessionInactivityMinutes?: number;
  /** Legacy: still accepted and converted to minutes. */
  sessionInactivityHours?: number;
  emailTemplates?: EmailTemplatesMap;
  supportContent?: SupportContent;
  agencyReferralEnabled?: boolean;
  agencyReferralCap?: number;
  agencyReferralLoginFeePct?: number;
  agencyReferralRewardMonths?: number;
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

  let sessionInactivityMinutes = current.sessionInactivityMinutes;
  if (input.sessionInactivityMinutes !== undefined) {
    sessionInactivityMinutes = clampSessionInactivityMinutes(input.sessionInactivityMinutes);
  } else if (input.sessionInactivityHours !== undefined) {
    sessionInactivityMinutes = clampSessionInactivityMinutes(
      input.sessionInactivityHours * 60
    );
  }
  const sessionInactivityHours = Math.max(1, Math.ceil(sessionInactivityMinutes / 60));

  const emailTemplates =
    input.emailTemplates !== undefined
      ? normalizeEmailTemplates(input.emailTemplates)
      : current.emailTemplates;

  const supportContent =
    input.supportContent !== undefined
      ? parseSupportContent(input.supportContent)
      : current.supportContent;

  const webAppUrl =
    input.webAppUrl !== undefined
      ? input.webAppUrl?.trim() || null
      : current.webAppUrl || null;
  const emailFrom =
    input.emailFrom !== undefined
      ? input.emailFrom?.trim() || null
      : current.emailFrom || null;

  const agencyReferralEnabled =
    input.agencyReferralEnabled !== undefined
      ? Boolean(input.agencyReferralEnabled)
      : current.agencyReferralEnabled;
  const agencyReferralCap =
    input.agencyReferralCap !== undefined
      ? clampReferralCap(input.agencyReferralCap)
      : current.agencyReferralCap;
  const agencyReferralLoginFeePct =
    input.agencyReferralLoginFeePct !== undefined
      ? clampReferralPct(input.agencyReferralLoginFeePct)
      : current.agencyReferralLoginFeePct;
  const agencyReferralRewardMonths =
    input.agencyReferralRewardMonths !== undefined
      ? clampReferralMonths(input.agencyReferralRewardMonths)
      : current.agencyReferralRewardMonths;

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
      sessionInactivityMinutes:
        sessionInactivityMinutes || SESSION_INACTIVITY_DEFAULT_MINUTES,
      emailTemplates: asJson(emailTemplates),
      supportContent: asJson(supportContent),
      agencyReferralEnabled,
      agencyReferralCap,
      agencyReferralLoginFeePct,
      agencyReferralRewardMonths,
    },
    update: {
      loginFees: asJson(loginFees),
      inquiryExpiryDays,
      webAppUrl,
      emailFrom,
      walletTopupMinLkr,
      walletTopupMaxLkr,
      sessionInactivityHours,
      sessionInactivityMinutes,
      emailTemplates: asJson(emailTemplates),
      supportContent: asJson(supportContent),
      agencyReferralEnabled,
      agencyReferralCap,
      agencyReferralLoginFeePct,
      agencyReferralRewardMonths,
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
