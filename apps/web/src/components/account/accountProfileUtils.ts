import type { UserRole } from "@tourpilot/shared";
import { formatPhoneDisplay } from "@tourpilot/shared";

export type AccountStat = {
  label: string;
  value: string;
  tone?: "default" | "accent" | "muted";
};

export type AccountField = {
  label: string;
  value: string;
};

export type AccountAction = {
  label: string;
  to: string;
  variant?: "primary" | "ghost" | "teal";
};

/** Wide bento cell — featured context, not a sidebar */
export type AccountHighlight = {
  id: string;
  label: string;
  value: string;
  description?: string;
  to: string;
  /** Grid span: 1 = half row, 2 = full row on desktop (12-col) */
  span?: 1 | 2;
};

const ROLE_LABELS: Record<UserRole, string> = {
  TOURIST: "Traveler",
  INFLUENCER: "Partner",
  AGENCY: "Agency",
  DRIVER: "Driver",
  ADMIN: "Administrator",
};

const ROLE_MODULES: Record<UserRole, string> = {
  TOURIST: "guided",
  INFLUENCER: "partner",
  AGENCY: "catalog",
  DRIVER: "operations",
  ADMIN: "governance",
};

export function roleLabel(role: UserRole): string {
  return ROLE_LABELS[role];
}

export function roleModule(role: UserRole): string {
  return ROLE_MODULES[role];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function formatPhone(phone: string): string {
  try {
    return formatPhoneDisplay(phone);
  } catch {
    return phone;
  }
}

export function lkr(amount: number): string {
  return `LKR ${amount.toLocaleString()}`;
}
