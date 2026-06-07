import { ModuleHeader } from "../../components/module/ModuleHeader";
import { formatDriverStatus } from "./types";
import { useDriverEarnings } from "./useDriverEarnings";

function metaField(metadata: Record<string, unknown> | null, key: string, fallback: string) {
  const v = metadata?.[key];
  return typeof v === "string" && v.trim() ? v : fallback;
}

export function DriverVehiclePage() {
  const { data, loading } = useDriverEarnings();

  if (loading) return <p className="muted">Loading…</p>;

  const vehicle = data?.vehicle ?? "Not set";
  const license = data?.licenseNo ?? "—";
  const status = formatDriverStatus(data?.status ?? "available");
  const meta = data?.metadata ?? null;

  return (
    <div className="module-shell module-operations">
      <ModuleHeader
        module="operations"
        title="Vehicle readiness"
        subtitle="Your registered vehicle and compliance details from your driver profile."
      />
      <div className="agency-stat-grid cols-2 drv-readiness-grid">
        <div className="agency-stat-card">
          <h3>Vehicle</h3>
          <p className="agency-stat-value">{vehicle}</p>
          <p className="agency-stat-sub">License: {license}</p>
        </div>
        <div className="agency-stat-card">
          <h3>Status</h3>
          <p className="agency-stat-value">{status}</p>
          <p className="agency-stat-sub">Update on your profile page</p>
        </div>
        <div className="agency-stat-card">
          <h3>Maintenance</h3>
          <p className="agency-stat-value">{metaField(meta, "maintenanceStatus", "Not recorded")}</p>
          <p className="agency-stat-sub">
            Next service: {metaField(meta, "nextService", "—")}
          </p>
        </div>
        <div className="agency-stat-card">
          <h3>Insurance</h3>
          <p className="agency-stat-value">{metaField(meta, "insuranceStatus", "Not recorded")}</p>
          <p className="agency-stat-sub">Expires: {metaField(meta, "insuranceExpiry", "—")}</p>
        </div>
      </div>
    </div>
  );
}
