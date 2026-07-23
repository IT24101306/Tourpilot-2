import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { ModuleHeader } from "../../components/module/ModuleHeader";

type AdminInfluencer = {
  id: string;
  bio: string | null;
  user: { id: string; name: string; phone: string; email: string | null; walletBalance: number };
  codeCount: number;
  commissionCount: number;
};

export function AdminInfluencersPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<AdminInfluencer[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const data = await api<AdminInfluencer[]>("/admin/influencers", { token });
    setRows(data);
    setLoading(false);
  }, [token]);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  return (
    <div className="module-shell module-governance">
      <ModuleHeader
        module="governance"
        title="Influencers"
        subtitle="Partner profiles, referral codes, and commission activity."
      />

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="gov-table-wrap">
          <table className="agency-table gov-table">
            <thead>
              <tr>
                <th>Partner</th>
                <th>Contact</th>
                <th>Wallet</th>
                <th>Codes</th>
                <th>Commissions</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.user.name}</strong>
                    {row.bio && <p className="muted gov-cell-sub">{row.bio}</p>}
                  </td>
                  <td>
                    {row.user.phone}
                    {row.user.email && <p className="muted gov-cell-sub">{row.user.email}</p>}
                  </td>
                  <td>{row.user.walletBalance.toLocaleString()} Credits</td>
                  <td>{row.codeCount}</td>
                  <td>{row.commissionCount}</td>
                  <td>
                    <Link
                      to={`/dashboard/admin/commissions`}
                      className="mini-btn"
                      state={{ filterUserId: row.user.id }}
                    >
                      Commissions
                    </Link>
                    <Link to={`/dashboard/admin/ledger?userId=${row.user.id}`} className="mini-btn">
                      Ledger
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
