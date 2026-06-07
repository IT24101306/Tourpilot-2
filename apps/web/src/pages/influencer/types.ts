import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";

export type InfluencerTour = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  days: number;
  basePriceLkr: number;
  influencerCommissionLkr: number;
  publicPriceLkr: number;
  coverUrl: string | null;
  seasonTag: string | null;
  agency: { id: string; name: string; slug: string };
};

export type ReferralCode = {
  id: string;
  code: string;
  commissionPct?: number;
  clickCount: number;
  isActive: boolean;
  inquiryCount: number;
  commissionCount: number;
  shareUrl?: string;
  sharePath: string;
  tour: (InfluencerTour & { influencerCommissionLkr?: number }) | null;
};

export type InfluencerCommission = {
  id: string;
  amountLkr: number;
  status: string;
  createdAt: string;
  code: string;
  inquiry: {
    id: string;
    status: string;
    tourist: { name: string };
  };
};

export type InfluencerDashboardData = {
  profile: { id: string; name: string; bio: string | null; walletBalance: number };
  stats: {
    totalEarned: number;
    pendingCommission: number;
    paidToWallet: number;
    walletBalance: number;
    totalClicks: number;
    activeCodes: number;
    totalInquiries: number;
  };
  codes: ReferralCode[];
  commissions: InfluencerCommission[];
};

type InfluencerContextValue = {
  data: InfluencerDashboardData | null;
  tours: InfluencerTour[];
  loading: boolean;
  error: string;
  toast: string;
  setToast: (msg: string) => void;
  refresh: () => Promise<void>;
  copyText: (text: string, label: string) => Promise<void>;
  codeModalOpen: boolean;
  setCodeModalOpen: (open: boolean) => void;
  preselectedTourId: string | undefined;
  openCreateForTour: (tourId?: string) => void;
};

export const InfluencerDashboardContext = createContext<InfluencerContextValue | null>(null);

export function useInfluencerDashboard() {
  const ctx = useContext(InfluencerDashboardContext);
  if (!ctx) throw new Error("useInfluencerDashboard must be used within InfluencerDashboardLayout");
  return ctx;
}

export function useInfluencerDashboardProvider(): InfluencerContextValue {
  const { token } = useAuth();
  const [data, setData] = useState<InfluencerDashboardData | null>(null);
  const [tours, setTours] = useState<InfluencerTour[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [codeModalOpen, setCodeModalOpen] = useState(false);
  const [preselectedTourId, setPreselectedTourId] = useState<string | undefined>();

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const [dash, tourList] = await Promise.all([
        api<InfluencerDashboardData>("/influencer/dashboard", { token }),
        api<InfluencerTour[]>("/influencer/tours", { token }),
      ]);
      setData(dash);
      setTours(tourList);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setToast(`${label} copied.`);
      setTimeout(() => setToast(""), 2200);
    } catch {
      setToast("Could not copy to clipboard.");
    }
  }

  function openCreateForTour(tourId?: string) {
    setPreselectedTourId(tourId);
    setCodeModalOpen(true);
  }

  return {
    data,
    tours,
    loading,
    error,
    toast,
    setToast,
    refresh,
    copyText,
    codeModalOpen,
    setCodeModalOpen,
    preselectedTourId,
    openCreateForTour,
  };
}

export function commissionPillClass(status: string): string {
  if (status === "PAID" || status === "APPROVED") return "ok";
  if (status === "DECLINED") return "late";
  return "warn";
}

export function inquiryPillClass(status: string): string {
  if (status === "ACCEPTED") return "ok";
  if (status === "DECLINED" || status === "EXPIRED") return "late";
  return "warn";
}

export function formatCommissionStatus(status: string): string {
  return status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function shareLinkForCode(code: ReferralCode): string {
  return code.shareUrl || `${window.location.origin}${code.sharePath}`;
}
