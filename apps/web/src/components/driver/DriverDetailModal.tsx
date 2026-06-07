import { useEffect, useState } from "react";
import { api, ApiError } from "../../api/client";
import { useConfirmAction } from "../confirm/ConfirmActionContext";
import { DashboardModal } from "../DashboardModal";
import { DriverAvailabilityCalendar } from "./DriverAvailabilityCalendar";
import {
  ASSIGNMENT_STATUSES,
  assignmentStatusClass,
  formatShortDate,
  type DriverAssignmentRow,
  type DriverDetail,
} from "../../pages/agency/driverTypes";
import { DRIVER_STATUS_OPTIONS } from "./DriverFormModal";

type Tab = "details" | "calendar" | "assignments";

type Props = {
  open: boolean;
  token: string;
  driverId: string;
  onClose: () => void;
  onAssign: () => void;
  onUpdated: () => void;
};

export function DriverDetailModal({ open, token, driverId, onClose, onAssign, onUpdated }: Props) {
  const { requestConfirm } = useConfirmAction();
  const [tab, setTab] = useState<Tab>("details");
  const [driver, setDriver] = useState<DriverDetail | null>(null);
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [assignedDates, setAssignedDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");

  useEffect(() => {
    if (!open || !driverId) return;
    setTab("details");
    setLoading(true);
    setError("");
    Promise.all([
      api<DriverDetail>(`/drivers/${driverId}`, { token }),
      api<{ blockedDates: string[]; assignedDates?: string[] }>(
        `/drivers/${driverId}/blocked-dates`,
        { token }
      ),
    ])
      .then(([detail, cal]) => {
        setDriver(detail);
        setBlockedDates(cal.blockedDates);
        setAssignedDates(cal.assignedDates ?? []);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load driver");
      })
      .finally(() => setLoading(false));
  }, [open, driverId, token]);

  function updateStatus(status: DriverDetail["status"]) {
    if (!driver) return;
    requestConfirm({
      title: "Update driver status?",
      confirmLabel: "Update status",
      summary: [
        { label: "Driver", value: driver.name },
        { label: "Current status", value: driver.status },
        { label: "New status", value: status },
      ],
      onConfirm: async () => {
        try {
          await api(`/drivers/${driver.id}/status`, {
            method: "PATCH",
            token,
            body: JSON.stringify({ status }),
          });
          setDriver({ ...driver, status });
          onUpdated();
        } catch (err) {
          setStatusMsg(err instanceof ApiError ? err.message : "Update failed");
        }
      },
    });
  }

  function updateAssignmentStatus(assignment: DriverAssignmentRow, status: string) {
    requestConfirm({
      title: "Update assignment status?",
      confirmLabel: "Update status",
      summary: [
        { label: "Trip", value: assignment.title },
        { label: "Current status", value: assignment.status },
        { label: "New status", value: status },
      ],
      onConfirm: async () => {
        try {
          await api(`/drivers/assignments/${assignment.id}`, {
            method: "PATCH",
            token,
            body: JSON.stringify({ status }),
          });
          const refreshed = await api<DriverDetail>(`/drivers/${driverId}`, { token });
          setDriver(refreshed);
          onUpdated();
        } catch (err) {
          setStatusMsg(err instanceof ApiError ? err.message : "Update failed");
        }
      },
    });
  }

  function removeAssignment(assignment: DriverAssignmentRow) {
    requestConfirm({
      title: "Remove assignment?",
      variant: "danger",
      confirmLabel: "Remove assignment",
      summary: [
        { label: "Driver", value: driver?.name ?? "—" },
        { label: "Trip", value: assignment.title },
        {
          label: "Dates",
          value: `${formatShortDate(assignment.startDate)}${
            assignment.endDate ? ` – ${formatShortDate(assignment.endDate)}` : ""
          }`,
        },
      ],
      onConfirm: async () => {
        try {
          await api(`/drivers/assignments/${assignment.id}`, { method: "DELETE", token });
          const refreshed = await api<DriverDetail>(`/drivers/${driverId}`, { token });
          setDriver(refreshed);
          onUpdated();
        } catch (err) {
          setStatusMsg(err instanceof ApiError ? err.message : "Remove failed");
        }
      },
    });
  }

  return (
    <DashboardModal
      open={open}
      title={driver?.name ?? "Driver details"}
      subtitle={driver?.vehicle ? `${driver.vehicle} · ${driver.status}` : undefined}
      onClose={onClose}
      dialogClassName="driver-detail-dialog"
    >
      {loading && <p className="muted">Loading…</p>}
      {error && <p className="driver-status">{error}</p>}

      {driver && !loading && (
        <>
          <div className="driver-detail-tabs">
            {(["details", "calendar", "assignments"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                className={`mini-btn ${tab === t ? "active" : ""}`}
                onClick={() => setTab(t)}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {tab === "details" && (
            <div className="driver-detail-grid">
              <DetailRow label="Phone" value={driver.phone || "—"} />
              <DetailRow label="License" value={driver.licenseNo || "—"} />
              <DetailRow label="Vehicle" value={driver.vehicle || "—"} />
              <DetailRow label="App login" value={driver.hasLogin ? "Linked" : "Not linked"} />
              <div className="field full">
                <label>Availability status</label>
                <select
                  className="driver-status-select"
                  value={driver.status}
                  onChange={(e) => updateStatus(e.target.value as DriverDetail["status"])}
                >
                  {DRIVER_STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              {driver.profile && (
                <>
                  {driver.profile.experience && (
                    <DetailRow label="Experience" value={driver.profile.experience} />
                  )}
                  {driver.profile.languages && (
                    <DetailRow label="Languages" value={driver.profile.languages} />
                  )}
                  {driver.profile.availabilityNotes && (
                    <DetailRow label="Notes" value={driver.profile.availabilityNotes} full />
                  )}
                  {driver.profile.bio && <DetailRow label="Bio" value={driver.profile.bio} full />}
                </>
              )}
              <p className="muted" style={{ fontSize: "0.85rem" }}>
                {driver.blockedDates.length} blocked day
                {driver.blockedDates.length === 1 ? "" : "s"} · {driver.assignments.length} active
                assignment{driver.assignments.length === 1 ? "" : "s"}
              </p>
            </div>
          )}

          {tab === "calendar" && (
            <>
              {!driver.hasLogin && (
                <p className="muted" style={{ marginBottom: 10 }}>
                  Driver has no TourPilot login — blocked days are managed by the driver app once
                  they register with the same phone.
                </p>
              )}
              <DriverAvailabilityCalendar
                blockedDates={blockedDates}
                assignedDates={assignedDates}
                readOnly
              />
            </>
          )}

          {tab === "assignments" && (
            <div className="driver-assignments-list">
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
                <button type="button" className="btn btn-primary" onClick={onAssign}>
                  + Assign trip
                </button>
              </div>
              {driver.assignments.length === 0 ? (
                <p className="muted">No trips assigned yet.</p>
              ) : (
                driver.assignments.map((a) => (
                  <div key={a.id} className="driver-assignment-card">
                    <div>
                      <strong>{a.title}</strong>
                      <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.85rem" }}>
                        {formatShortDate(a.startDate)}
                        {a.endDate ? ` → ${formatShortDate(a.endDate)}` : ""}
                        {a.inquiry
                          ? ` · ${a.inquiry.touristName} (${a.inquiry.pax} pax)`
                          : ""}
                      </p>
                      {a.notes && (
                        <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.85rem" }}>
                          {a.notes}
                        </p>
                      )}
                    </div>
                    <div className="driver-assignment-actions">
                      <select
                        className="driver-status-select"
                        value={a.status}
                        onChange={(e) => updateAssignmentStatus(a, e.target.value)}
                        aria-label="Assignment status"
                      >
                        {ASSIGNMENT_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <span className={`agency-status ${assignmentStatusClass(a.status)}`}>
                        {a.status}
                      </span>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => removeAssignment(a)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {statusMsg && <p className="driver-status">{statusMsg}</p>}
        </>
      )}
    </DashboardModal>
  );
}

function DetailRow({
  label,
  value,
  full,
}: {
  label: string;
  value: string;
  full?: boolean;
}) {
  return (
    <div className={full ? "field full" : "field"}>
      <label>{label}</label>
      <p style={{ margin: 0 }}>{value}</p>
    </div>
  );
}
