import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { ModuleHeader } from "../../components/module/ModuleHeader";

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

export function AdminDriversPage() {
  const { token } = useAuth();
  const [data, setData] = useState<DriversPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    api<DriversPayload>("/admin/drivers", { token })
      .then(setData)
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="module-shell module-governance">
      <ModuleHeader
        module="governance"
        title="Drivers"
        subtitle="Agency-linked drivers and registered driver accounts."
      />

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
                  {data.agencyDrivers.map((d) => (
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
                  ))}
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
                  {data.driverProfiles.map((p) => (
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
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
