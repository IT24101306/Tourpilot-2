import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";

export type DriverEarnings = {
  walletBalance: number;
  thisWeekLkr: number;
  completedTrips: number;
  upcomingTrips: number;
  vehicle: string | null;
  licenseNo: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
  recentCompleted: Array<{
    id: string;
    title: string;
    date: string;
    pax: number | null;
  }>;
};

export function useDriverEarnings() {
  const { token } = useAuth();
  const [data, setData] = useState<DriverEarnings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    api<DriverEarnings>("/drivers/me/earnings", { token })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [token]);

  return { data, loading };
}
