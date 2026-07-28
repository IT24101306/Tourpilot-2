import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import {
  AdminDriverFormModal,
  type AdminDriverFormValues,
} from "../../components/admin/AdminDriverFormModal";

type DriversPayload = {
  agencyDrivers: {
    id: string;
    name: string;
    phone: string | null;
    vehicle: string | null;
    status: string;
    agency: { id: string; name: string; slug: string };
    userId: string | null;
    user: { id: string; name: string; phone: string } | null;
    assignmentCount: number;
  }[];
  driverProfiles: {
    id: string;
    licenseNo: string | null;
    vehicle: string | null;
    status: string;
    user: { id: string; name: string; phone: string; email: string | null; isActive: boolean };
  }[];
};

type AgencyOption = { id: string; name: string; slug: string };

export function AdminDriversPage() {
  const { token } = useAuth();
  const [data, setData] = useState<DriversPayload | null>(null);
  const [agencies, setAgencies] = useState<AgencyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [drivers, agencyRows] = await Promise.all([
        api<DriversPayload>("/admin/drivers", { token }),
        api<AgencyOption[]>("/admin/agencies", { token }).catch(() => [] as AgencyOption[]),
      ]);
      setData(drivers);
      setAgencies(
        agencyRows.map((a) => ({ id: a.id, name: a.name, slug: a.slug })).sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(values: AdminDriverFormValues) {
    if (!token) return;
    setSaving(true);
    setMsg("");
    try {
      await api("/admin/drivers", {
        method: "POST",
        token,
        body: JSON.stringify({
          name: values.name,
          phone: values.phone,
          email: values.email || null,
          licenseNo: values.licenseNo || undefined,
          vehicle: values.vehicle || undefined,
          status: values.status,
          agencyId: values.agencyId || null,
          isActive: values.isActive,
        }),
      });
      setCreateOpen(false);
      setMsg(`Driver ${values.name} created. They can log in with OTP.`);
      await load();
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Could not create driver");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="module-shell module-governance">
      <ModuleHeader
        module="governance"
        title="Drivers"
        subtitle="Agency-linked drivers and registered driver accounts."
      >
        <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
          Create driver
        </button>
      </ModuleHeader>

      {msg ? <p className="entity-status">{msg}</p> : null}

      {loading || !data ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          <section className="gov-board">
            <div className="gov-board-head">
              <h3>Agency drivers</h3>
            </div>
            <div className="gov-table-wrap">
              <table className="agency-table gov-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Agency</th>
                    <th>Vehicle</th>
                    <th>Status</th>
                    <th>Assignments</th>
                  </tr>
                </thead>
                <tbody>
                  {data.agencyDrivers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="muted">
                        No agency-linked drivers yet.
                      </td>
                    </tr>
                  ) : (
                    data.agencyDrivers.map((d) => (
                      <tr key={d.id}>
                        <td>
                          {d.name}
                          {d.user && <span className="muted"> · linked account</span>}
                        </td>
                        <td>{d.agency.name}</td>
                        <td>{d.vehicle ?? "—"}</td>
                        <td>{d.status}</td>
                        <td>{d.assignmentCount}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="gov-board">
            <div className="gov-board-head">
              <h3>Driver accounts</h3>
            </div>
            <div className="gov-table-wrap">
              <table className="agency-table gov-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>License</th>
                    <th>Vehicle</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.driverProfiles.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="muted">
                        No driver accounts yet. Use Create driver.
                      </td>
                    </tr>
                  ) : (
                    data.driverProfiles.map((p) => (
                      <tr key={p.id}>
                        <td>
                          {p.user.name}
                          <br />
                          <span className="muted">{p.user.phone}</span>
                        </td>
                        <td>{p.licenseNo ?? "—"}</td>
                        <td>{p.vehicle ?? "—"}</td>
                        <td>{p.status}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <AdminDriverFormModal
        open={createOpen}
        loading={saving}
        agencies={agencies}
        onClose={() => setCreateOpen(false)}
        onSave={(values) => void handleCreate(values)}
      />
    </div>
  );
}
