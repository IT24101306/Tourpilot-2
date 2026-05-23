import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

export function AdminDashboard() {
  const { token } = useAuth();
  const [pending, setPending] = useState<AgencyPending[]>([]);

  useEffect(() => {
    if (!token) return;
    api<AgencyPending[]>("/admin/agencies/pending", { token }).then(setPending).catch(console.error);
  }, [token]);

  async function approve(id: string) {
    if (!token) return;
    await api(`/admin/agencies/${id}/approve`, { method: "PATCH", token });
    setPending((p) => p.filter((a) => a.id !== id));
  }

  return (
    <>
      <h1 className="section-title">Admin panel</h1>
      <div className="panel">
        <h3>Pending agencies</h3>
        {pending.length === 0 && <p className="muted">No pending approvals.</p>}
        {pending.map((a) => (
          <div key={a.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <span>
              {a.name} — {a.owner.name} ({a.owner.phone})
            </span>
            <button type="button" className="btn btn-primary" onClick={() => approve(a.id)}>
              Approve
            </button>
          </div>
        ))}
      </div>
      <div className="panel">
        <h3>CMS</h3>
        <p className="muted">Edit home page blocks via API /admin/cms/home</p>
      </div>
    </>
  );
}

type AgencyPending = {
  id: string;
  name: string;
  owner: { name: string; phone: string };
};
