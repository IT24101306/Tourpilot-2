import { FormEvent, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import {
  DriverFormModal,
  defaultDriverForm,
  type DriverFormState,
} from "../../components/driver/DriverFormModal";
import { DriverCalendarModal } from "../../components/driver/DriverCalendarModal";
import { DriverDetailModal } from "../../components/driver/DriverDetailModal";
import { DriverAssignModal } from "../../components/driver/DriverAssignModal";
import {
  type AgencyDriverRow,
  type AssignableInquiry,
  type AssignableTour,
  driverStatusClass,
} from "./driverTypes";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import { OpsMetricStrip } from "../../components/module/OpsMetricStrip";
import "../../styles/dashboard.css";

export function AgencyDriversPage() {
  const { token } = useAuth();
  const [drivers, setDrivers] = useState<AgencyDriverRow[]>([]);
  const [inquiries, setInquiries] = useState<AssignableInquiry[]>([]);
  const [tours, setTours] = useState<AssignableTour[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");

  const [driverModalOpen, setDriverModalOpen] = useState(false);
  const [driverForm, setDriverForm] = useState<DriverFormState>(defaultDriverForm());
  const [driverStatus, setDriverStatus] = useState("");
  const [driverSaving, setDriverSaving] = useState(false);

  const [detailDriverId, setDetailDriverId] = useState<string | null>(null);
  const [calendarDriver, setCalendarDriver] = useState<{ id: string; name: string } | null>(null);
  const [assignDriver, setAssignDriver] = useState<{ id: string; name: string } | null>(null);

  const filteredDrivers = useMemo(() => {
    if (statusFilter === "all") return drivers;
    return drivers.filter((d) => d.status === statusFilter);
  }, [drivers, statusFilter]);

  const stats = useMemo(
    () => ({
      total: drivers.length,
      available: drivers.filter((d) => d.status === "Available").length,
      onTour: drivers.filter((d) => d.status === "On Tour").length,
      offDuty: drivers.filter((d) => d.status === "Off Duty").length,
    }),
    [drivers]
  );

  async function refresh() {
    if (!token) return;
    const path = statusFilter === "all" ? "/drivers/agency/mine" : `/drivers/agency/mine?status=${statusFilter}`;
    const [driverList, inquiryList, tourList] = await Promise.all([
      api<AgencyDriverRow[]>(path, { token }),
      api<AssignableInquiry[]>("/inquiries/mine", { token }),
      api<AssignableTour[]>("/tours/agency/mine", { token }),
    ]);
    setDrivers(driverList);
    setInquiries(inquiryList);
    setTours(
      tourList.map((t) => ({
        id: t.id,
        title: t.title,
        days: t.days,
        isPublished: t.isPublished,
      }))
    );
  }

  useEffect(() => {
    if (!token) return;
    refresh().catch(console.error);
  }, [token, statusFilter]);

  function openAddDriver() {
    setDriverForm(defaultDriverForm());
    setDriverStatus("");
    setDriverModalOpen(true);
  }

  async function saveDriver(e: FormEvent) {
    e.preventDefault();
    if (!token || !driverForm.phone.trim()) return;
    if (!driverForm.profileLocked && !driverForm.name.trim()) return;
    if (driverForm.lookupError) return;

    setDriverSaving(true);
    setDriverStatus("");
    try {
      await api("/drivers", {
        method: "POST",
        token,
        body: JSON.stringify({
          name: driverForm.name.trim(),
          licenseNo: driverForm.licenseNo.trim() || undefined,
          phone: driverForm.phone.trim() || undefined,
          vehicle: driverForm.vehicle.trim() || undefined,
          status: driverForm.status,
        }),
      });
      setDriverStatus(
        "Driver added. They can log in at /login with this phone and OTP — no signup needed."
      );
      await refresh();
      setTimeout(() => {
        setDriverModalOpen(false);
        setDriverForm(defaultDriverForm());
        setDriverStatus("");
      }, 600);
    } catch (err) {
      setDriverStatus(err instanceof ApiError ? err.message : "Failed to save driver");
    } finally {
      setDriverSaving(false);
    }
  }

  async function updateDriverStatus(driverId: string, status: DriverFormState["status"]) {
    if (!token) return;
    try {
      await api(`/drivers/${driverId}/status`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ status }),
      });
      setDrivers((prev) => prev.map((d) => (d.id === driverId ? { ...d, status } : d)));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to update status");
    }
  }

  const detailDriver = drivers.find((d) => d.id === detailDriverId);

  return (
    <div className="module-shell module-operations">
      <ModuleHeader
        module="operations"
        title="Fleet & drivers"
        subtitle="Add drivers, assign trips, and manage availability on the calendar."
      >
        <button type="button" className="btn btn-primary" onClick={openAddDriver}>
          Add driver
        </button>
      </ModuleHeader>

      <OpsMetricStrip
        metrics={[
          {
            id: "total",
            label: "Total drivers",
            value: stats.total,
            hint: "On your roster",
            active: statusFilter === "all",
            onClick: () => setStatusFilter("all"),
          },
          {
            id: "avail",
            label: "Available",
            value: stats.available,
            hint: "Ready to assign",
            active: statusFilter === "Available",
            onClick: () => setStatusFilter("Available"),
          },
          {
            id: "tour",
            label: "On tour",
            value: stats.onTour,
            hint: "Currently driving",
            active: statusFilter === "On Tour",
            onClick: () => setStatusFilter("On Tour"),
          },
          {
            id: "off",
            label: "Off duty",
            value: stats.offDuty,
            hint: "Unavailable",
            active: statusFilter === "Off Duty",
            onClick: () => setStatusFilter("Off Duty"),
          },
        ]}
      />

      <div className="table-tools">
        <div className="tools-left">
          <select
            className="table-filter"
            aria-label="Filter drivers by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All status</option>
            <option value="Available">Available</option>
            <option value="On Tour">On tour</option>
            <option value="Off Duty">Off duty</option>
          </select>
        </div>
        <div className="tools-right" />
      </div>

      <div className="table-wrap">
        <table className="hotel-table">
          <thead>
            <tr>
              <th>Driver</th>
              <th>License</th>
              <th>Phone</th>
              <th>Vehicle</th>
              <th>Status</th>
              <th>Availability</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredDrivers.length === 0 ? (
              <tr>
                <td colSpan={7} className="empty-text">
                  No drivers yet. Click &quot;Add driver&quot; to get started.
                </td>
              </tr>
            ) : (
              filteredDrivers.map((driver) => (
                <tr key={driver.id}>
                  <td>
                    <strong>{driver.name}</strong>
                    {!driver.hasLogin && (
                      <p className="muted" style={{ fontSize: "0.75rem", margin: "4px 0 0" }}>
                        No app login
                      </p>
                    )}
                  </td>
                  <td>{driver.licenseNo || "—"}</td>
                  <td>{driver.phone || "—"}</td>
                  <td>{driver.vehicle || "—"}</td>
                  <td>
                    <select
                      className="driver-status-select"
                      aria-label="Driver status"
                      value={driver.status}
                      onChange={(e) =>
                        updateDriverStatus(driver.id, e.target.value as DriverFormState["status"])
                      }
                    >
                      <option value="Available">Available</option>
                      <option value="On Tour">On Tour</option>
                      <option value="Off Duty">Off Duty</option>
                    </select>
                    <span
                      className={`agency-status ${driverStatusClass(driver.status)}`}
                      style={{ display: "block", marginTop: 4, fontSize: "0.75rem" }}
                    >
                      {driver.status}
                    </span>
                  </td>
                  <td>
                    {driver.hasLogin ? (
                      <span className="muted" style={{ fontSize: "0.85rem" }}>
                        {driver.blockedDates.length > 0
                          ? `${driver.blockedDates.length} blocked day${driver.blockedDates.length === 1 ? "" : "s"}`
                          : "No blocks"}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    <div className="driver-row-actions">
                      <button
                        type="button"
                        className="btn btn-lite"
                        onClick={() => setDetailDriverId(driver.id)}
                      >
                        Details
                      </button>
                      <button
                        type="button"
                        className="btn btn-lite"
                        onClick={() => setAssignDriver({ id: driver.id, name: driver.name })}
                      >
                        Assign
                      </button>
                      <button
                        type="button"
                        className="btn btn-lite"
                        onClick={() => setCalendarDriver({ id: driver.id, name: driver.name })}
                      >
                        Calendar
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <DriverFormModal
        open={driverModalOpen}
        form={driverForm}
        status={driverStatus}
        saving={driverSaving}
        token={token}
        onClose={() => setDriverModalOpen(false)}
        onChange={setDriverForm}
        onSubmit={saveDriver}
      />

      {token && calendarDriver && (
        <DriverCalendarModal
          open
          token={token}
          driverId={calendarDriver.id}
          driverName={calendarDriver.name}
          onClose={() => setCalendarDriver(null)}
        />
      )}

      {token && detailDriverId && (
        <DriverDetailModal
          open
          token={token}
          driverId={detailDriverId}
          onClose={() => setDetailDriverId(null)}
          onAssign={() => {
            if (detailDriver) {
              setAssignDriver({ id: detailDriver.id, name: detailDriver.name });
            }
          }}
          onUpdated={() => refresh()}
        />
      )}

      {token && assignDriver && (
        <DriverAssignModal
          open
          token={token}
          driverId={assignDriver.id}
          driverName={assignDriver.name}
          inquiries={inquiries}
          tours={tours}
          onClose={() => setAssignDriver(null)}
          onAssigned={() => refresh()}
        />
      )}
    </div>
  );
}
