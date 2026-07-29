import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { UserRole } from "@tourpilot/shared";
import { api } from "../api/client";

export type AuthUser = {
  id: string;
  phone: string;
  name: string;
  role: UserRole;
  email?: string | null;
  avatarUrl?: string | null;
  walletBalance: number;
  /** Effective login fee for this account (role default or custom override). */
  loginFee?: number;
  loginFeeOverride?: number | null;
  trial?: {
    active: boolean;
    expiredUnpaid: boolean;
    endsAt: string | null;
    daysRemaining: number | null;
    packageId: string | null;
    packageName: string | null;
    priceLkr: number | null;
    priceLabel: string | null;
    billing: "MONTHLY" | "ONE_TIME" | "PAYG" | "CUSTOM" | null;
    activatedAt: string | null;
  };
  subscription?: {
    autoRenew: boolean;
    periodEnd: string | null;
  };
  touristProfile?: { loyaltyPoints: number; displayCurrency?: string } | null;
  agency?: {
    id: string;
    name: string;
    slug: string;
    status: string;
    logoUrl?: string | null;
    features?: AgencyFeatures;
    /** Agency idle override in minutes; null = platform default. */
    sessionInactivityMinutes?: number | null;
  } | null;
  /** How this AGENCY user relates to `agency` (owner vs invited staff). */
  agencyMembership?: "owner" | "staff" | null;
  staffTitle?: string | null;
  agencyDriver?: {
    id: string;
    agencyId: string;
    agencyName: string;
    agencySlug: string;
    status: string;
  } | null;
};

export type AgencyFeatures = {
  driversAndPartners: boolean;
  support: boolean;
  walletTopup: boolean;
  offers: boolean;
  display: boolean;
  readyMadeTours: boolean;
  customInquiries: boolean;
  negotiationsBookings: boolean;
  customDomain: boolean;
  externalStorefront: boolean;
  /** Monetized package: idle session expires and re-login fee applies. */
  sessionInactivityTimeout: boolean;
};

export const DEFAULT_AGENCY_FEATURES: AgencyFeatures = {
  driversAndPartners: true,
  support: true,
  walletTopup: true,
  offers: true,
  display: true,
  readyMadeTours: true,
  customInquiries: true,
  negotiationsBookings: true,
  customDomain: false,
  externalStorefront: false,
  sessionInactivityTimeout: false,
};

export function agencyFeaturesOf(user: AuthUser | null | undefined): AgencyFeatures {
  return { ...DEFAULT_AGENCY_FEATURES, ...(user?.agency?.features ?? {}) };
}

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  setSession: (token: string, user: AuthUser) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const TOKEN_KEY = "tourpilotAuthToken";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true);

  const setSession = useCallback((newToken: string, newUser: AuthUser) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
    setLoading(false);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    const data = await api<{ user: AuthUser }>("/auth/me", { token });
    setUser(data.user);
  }, [token]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    // After OTP/password login, user is already set — skip /auth/me to avoid logout on transient API errors.
    if (user) {
      setLoading(false);
      return;
    }
    refreshUser()
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, [token, user, refreshUser, logout]);

  const value = useMemo(
    () => ({ user, token, loading, setSession, logout, refreshUser }),
    [user, token, loading, setSession, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
