import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";

export type DriverProfile = {
  licenseNo: string | null;
  vehicle: string | null;
  status: string;
  bio: string | null;
  articles: unknown;
};

export type DriverMe = {
  id: string;
  phone: string;
  name: string;
  role: string;
  walletBalance: number;
  driverProfile: DriverProfile | null;
};


export function formatDriverStatus(status: string): string {
  const map: Record<string, string> = {
    available: "Available",
    on_tour: "On Tour",
    off_duty: "Off Duty",
  };
  return map[status] ?? status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function useDriverMe() {
  const { token } = useAuth();
  const [me, setMe] = useState<DriverMe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    api<{ user: DriverMe }>("/driver/me", { token })
      .then((data) => setMe(data.user))
      .catch(() => setMe(null))
      .finally(() => setLoading(false));
  }, [token]);

  async function refresh() {
    if (!token) return;
    const data = await api<{ user: DriverMe }>("/driver/me", { token });
    setMe(data.user);
  }

  return { me, loading, refresh };
}
