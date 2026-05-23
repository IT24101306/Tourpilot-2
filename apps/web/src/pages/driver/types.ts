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

export type AssignedTour = {
  code: string;
  route: string;
  time: string;
  guests: number;
  status: "Scheduled" | "On Route" | "Completed";
};

export const DEMO_ASSIGNMENTS: AssignedTour[] = [
  {
    code: "DRV-2401",
    route: "Ella City Hotel → Little Adam's Peak",
    time: "09:30 AM",
    guests: 2,
    status: "Scheduled",
  },
  {
    code: "DRV-2402",
    route: "Nine Arch Bridge → Ravana Falls",
    time: "02:00 PM",
    guests: 4,
    status: "Scheduled",
  },
  {
    code: "DRV-2398",
    route: "Bandarawela → Horton Plains",
    time: "05:30 AM",
    guests: 3,
    status: "Completed",
  },
];

export const DEMO_SCHEDULE = [
  { time: "05:30 AM", title: "Pickup — Bandarawela Station", done: true },
  { time: "09:30 AM", title: "Pickup — Ella City Hotel", done: false },
  { time: "11:00 AM", title: "Drop — Little Adam's Peak trailhead", done: false },
  { time: "02:00 PM", title: "Pickup — Nine Arch Bridge", done: false },
];

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
