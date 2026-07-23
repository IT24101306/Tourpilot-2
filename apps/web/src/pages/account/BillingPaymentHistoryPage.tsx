import { Fragment, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { formatCredits } from "../../lib/walletLedger";

type PaymentRow = {
  id: string;
  packageId: string;
  packageName: string;
  amountLkr: number;
  currency: string;
  status: string;
  provider: string;
  payhereOrderId: string | null;
  paidAt: string | null;
  createdAt: string;
};

export function BillingPaymentHistoryPage() {
  const { token } = useAuth();
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const data = await api<PaymentRow[]>("/subscription/payments", { token });
      setRows(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load payment history");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="account-billing-page">
      <nav className="account-billing-crumbs" aria-label="Breadcrumb">
        <Link to="/profile">Account</Link>
        <span aria-hidden="true">/</span>
        <span>Billing</span>
        <span aria-hidden="true">/</span>
        <span>Payment history</span>
      </nav>
      <h1 className="account-billing-title">Payment history</h1>

      {error ? <p className="form-error">{error}</p> : null}
      {loading ? <p className="muted">Loading…</p> : null}

      {!loading && rows.length === 0 ? (
        <div className="account-billing-card">
          <p className="muted account-billing-empty">No subscription payments yet.</p>
        </div>
      ) : null}

      {!loading && rows.length > 0 ? (
        <div className="account-billing-card account-billing-card--table">
          <table className="account-billing-table">
            <thead>
              <tr>
                <th>Payment ID</th>
                <th>Service</th>
                <th>Paid at</th>
                <th>Amount</th>
                <th>
                  <span className="sr-only">Details</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const open = expandedId === row.id;
                return (
                  <Fragment key={row.id}>
                    <tr>
                      <td>
                        <strong>{row.id.slice(0, 12)}</strong>
                      </td>
                      <td>
                        <div>{row.packageName}</div>
                        <div className="account-billing-table__sub">{row.packageId}</div>
                      </td>
                      <td>
                        {row.paidAt
                          ? new Date(row.paidAt).toISOString().slice(0, 10)
                          : new Date(row.createdAt).toISOString().slice(0, 10)}
                      </td>
                      <td>{formatCredits(row.amountLkr)}</td>
                      <td>
                        <button
                          type="button"
                          className="account-billing-chevron"
                          aria-expanded={open}
                          aria-label="Show payment details"
                          onClick={() => setExpandedId(open ? null : row.id)}
                        >
                          ›
                        </button>
                      </td>
                    </tr>
                    {open ? (
                      <tr className="account-billing-table__detail">
                        <td colSpan={5}>
                          Status: {row.status} · Provider: {row.provider}
                          {row.payhereOrderId ? ` · Order ${row.payhereOrderId}` : ""}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
