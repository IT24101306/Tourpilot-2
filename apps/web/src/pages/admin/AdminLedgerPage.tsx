import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import type { AdminLedgerRow } from "./types";

export function AdminLedgerPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<AdminLedgerRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    api<AdminLedgerRow[]>("/admin/ledger", { token })
      .then(setRows)
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="module-shell module-governance">
      <ModuleHeader
        module="governance"
        title="Wallet ledger"
        subtitle="Login fees, top-ups, commissions, and admin adjustments."
      />

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="gov-table-wrap">
          <table className="agency-table gov-table">
            <thead>
              <tr>
                <th>When</th>
                <th>User</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Balance after</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.createdAt).toLocaleString()}</td>
                  <td>
                    {r.user.name}
                    <br />
                    <span className="muted">
                      {r.user.role} · {r.user.phone}
                    </span>
                  </td>
                  <td>{r.type}</td>
                  <td className={r.amountLkr < 0 ? "gov-amount-neg" : "gov-amount-pos"}>
                    {r.amountLkr >= 0 ? "+" : ""}
                    {r.amountLkr.toLocaleString()}
                  </td>
                  <td>{r.balanceAfter.toLocaleString()} Credits</td>
                  <td className="muted">{r.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
