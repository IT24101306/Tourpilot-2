import { useEffect, useState } from "react";
import { api, ApiError } from "../../api/client";
import { DashboardModal } from "../DashboardModal";
import { DriverAvailabilityCalendar } from "./DriverAvailabilityCalendar";

type Props = {
  open: boolean;
  token: string;
  driverId: string;
  driverName: string;
  onClose: () => void;
};

export function DriverCalendarModal({ open, token, driverId, driverName, onClose }: Props) {
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [assignedDates, setAssignedDates] = useState<string[]>([]);
  const [hasLogin, setHasLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !driverId) return;
    setLoading(true);
    setError("");
    api<{ blockedDates: string[]; assignedDates?: string[]; hasLogin: boolean }>(
      `/drivers/${driverId}/blocked-dates`,
      { token }
    )
      .then((data) => {
        setBlockedDates(data.blockedDates);
        setAssignedDates(data.assignedDates ?? []);
        setHasLogin(data.hasLogin);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load calendar");
      })
      .finally(() => setLoading(false));
  }, [open, driverId, token]);

  return (
    <DashboardModal
      open={open}
      title={`${driverName} — Availability`}
      subtitle="Green = available, blue = assigned trip, red = driver blocked that day."
      onClose={onClose}
      dialogClassName="driver-calendar-dialog"
    >
      {loading && <p className="muted">Loading calendar…</p>}
      {error && <p className="driver-status" style={{ color: "#9b1c1c" }}>{error}</p>}
      {!loading && !hasLogin && (
        <p className="muted">
          This driver has not linked a TourPilot login yet. Ask them to register with the same
          phone number, then block dates from their driver dashboard.
        </p>
      )}
      {!loading && (
        <DriverAvailabilityCalendar
          blockedDates={blockedDates}
          assignedDates={assignedDates}
          readOnly
        />
      )}
    </DashboardModal>
  );
}
