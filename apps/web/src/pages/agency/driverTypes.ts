import type { DriverFormState } from "../../components/driver/DriverFormModal";

export type AgencyDriverRow = {
  id: string;
  name: string;
  phone: string | null;
  licenseNo: string | null;
  vehicle: string | null;
  status: DriverFormState["status"];
  blockedDates: string[];
  hasLogin: boolean;
  userId?: string | null;
};

export type DriverAssignmentRow = {
  id: string;
  agencyDriverId: string;
  title: string;
  startDate: string;
  endDate: string | null;
  notes: string | null;
  status: "Scheduled" | "On Route" | "Completed" | "Cancelled";
  inquiryId: string | null;
  tourId: string | null;
  inquiry?: {
    id: string;
    pax: number;
    status: string;
    touristName: string;
    touristPhone: string;
    tourTitle: string | null;
  } | null;
  tour?: { id: string; title: string; days: number } | null;
};

export type DriverDetail = AgencyDriverRow & {
  profile: {
    bio: string | null;
    experience: string;
    languages: string;
    availabilityNotes: string;
  } | null;
  assignments: DriverAssignmentRow[];
};

export type AssignableInquiry = {
  id: string;
  status: string;
  pax: number;
  startDate: string | null;
  endDate: string | null;
  tourist?: { name: string; phone: string };
  tour?: { id: string; title: string } | null;
};

export type AssignableTour = {
  id: string;
  title: string;
  days: number;
  isPublished: boolean;
};

export const ASSIGNMENT_STATUSES = ["Scheduled", "On Route", "Completed", "Cancelled"] as const;

export function driverStatusClass(status: string): string {
  if (status === "Available") return "ok";
  if (status === "On Tour") return "warn";
  return "late";
}

export function assignmentStatusClass(status: string): string {
  if (status === "Completed") return "ok";
  if (status === "On Route") return "warn";
  if (status === "Cancelled") return "late";
  return "warn";
}

export function formatShortDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function toDatetimeLocalValue(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}
