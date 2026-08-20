import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import {
  formatCredits,
  formatWalletAmount,
  walletTxnLabel,
  type WalletLedgerEntry,
} from "../../lib/walletLedger";
import { WalletTopupPanel } from "../wallet/WalletTopupPanel";
import "../../styles/dashboard.css";
import { LOGIN_FEE_LKR } from "@tourpilot/shared";


const HISTORY_PREVIEW_COUNT = 3;

type Props = {
  refreshKey?: number;
};

function HistoryTable({
  rows,
  emptyMessage,
  showType = false,
}: {
  rows: WalletLedgerEntry[];
  emptyMessage: string;
  showType?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  if (rows.length === 0) {
    return <p className="muted wallet-history-empty">{emptyMessage}</p>;
  }

  const canExpand = rows.length > HISTORY_PREVIEW_COUNT;
  const visibleRows = expanded || !canExpand ? rows : rows.slice(0, HISTORY_PREVIEW_COUNT);
  const hiddenCount = rows.length - HISTORY_PREVIEW_COUNT;

  return (
    <div className="wallet-history-table-wrap">
      <table className="wallet-history-table">
        <thead>
          <tr>
            <th>When</th>
            {showType && <th>Type</th>}
            <th>Amount</th>
            <th>Balance after</th>
            <th className="wallet-history-table__note-col">Note</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row) => (
            <tr key={row.id}>
              <td>{new Date(row.createdAt).toLocaleString()}</td>
              {showType && <td>{walletTxnLabel(row.type)}</td>}
              <td className={row.amountLkr < 0 ? "wallet-history-amount--debit" : "wallet-history-amount--credit"}>
                {formatWalletAmount(row.amountLkr)}
              </td>
              <td>{formatCredits(row.balanceAfter)}</td>
              <td className="muted wallet-history-table__note-col">{row.note ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {canExpand && (
        <div className="wallet-history-expand">
          <button
            type="button"
            className="wallet-history-expand__btn"
            aria-expanded={expanded}
            onClick={() => setExpanded((open) => !open)}
          >
            {expanded
              ? "Show less"
              : `Expand · ${hiddenCount} more`}
          </button>
        </div>
      )}
    </div>
  );
}

export function WalletHistoryPanel({ refreshKey = 0 }: Props) {
  const { token, user } = useAuth();
  const [entries, setEntries] = useState<WalletLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    setError("");
    setLoading(true);
    try {
      const rows = await api<WalletLedgerEntry[]>("/wallet/ledger?limit=100", { token });
      setEntries(rows);
    } catch (err) {
      setEntries([]);
      setError(err instanceof ApiError ? err.message : "Could not load wallet history");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const loginHistory = useMemo(
    () => entries.filter((e) => e.type === "LOGIN_FEE"),
    [entries]
  );

  async function handleTopup(amount: number) {
    if (!token) throw new Error("Not signed in");
    return api<{ mode: "payhere"; checkoutUrl: string; fields: Record<string, string> }>("/wallet/topup", {
      method: "POST",
      token,
      body: JSON.stringify({ amount }),
    });
  }

  if (!token || !user) return null;

  const loginFee = user.loginFee ?? LOGIN_FEE_LKR[user.role];

  return (
    <section id="account-wallet" className="wallet-history-panel" aria-label="Wallet activity">
      <div className="wallet-history-panel__head account-block-head">
        <div>
          <h2 className="wallet-history-panel__title">Wallet</h2>
          <p className="wallet-history-panel__subtitle">
            Keep a balance ready for login fees — top up anytime.
          </p>
        </div>
      </div>

      <WalletTopupPanel
        balance={user.walletBalance}
        feeHint={loginFee > 0 ? loginFee : undefined}
        onTopup={handleTopup}
        className="wallet-history-panel__topup"
        emphasize
      />

      {error && <p className="form-error">{error}</p>}
      {loading ? <p className="muted">Loading wallet history…</p> : null}

      {!loading && (
        <>
          <div className="wallet-history-section">
            <h3 className="wallet-history-section__title">Login history</h3>
            <p className="muted wallet-history-section__hint">
              Each successful login that charges a fee is recorded here with the amount deducted.
            </p>
            <HistoryTable
              rows={loginHistory}
              emptyMessage={
                loginFee > 0
                  ? "No login fees recorded yet."
                  : "Your role is not charged a login fee."
              }
            />
          </div>

          <div className="wallet-history-section">
            <h3 className="wallet-history-section__title">Wallet balance history</h3>
            <p className="muted wallet-history-section__hint">
              Top-ups, login fees, commissions, refunds, and adjustments.
            </p>
            <HistoryTable
              rows={entries}
              emptyMessage="No wallet activity yet."
              showType
            />
          </div>
        </>
      )}
    </section>
  );
}
