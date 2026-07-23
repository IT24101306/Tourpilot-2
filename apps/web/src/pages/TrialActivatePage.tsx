import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { AuthLayout } from "../components/AuthLayout";
import { WalletTopupPanel } from "../components/wallet/WalletTopupPanel";

export function TrialActivatePage() {
  const { token, user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [trial, setTrial] = useState(user?.trial ?? null);
  const [balance, setBalance] = useState(user?.walletBalance ?? 0);

  useEffect(() => {
    if (!token) return;
    api<{ trial: NonNullable<typeof trial>; walletBalance: number }>("/billing/trial", { token })
      .then((data) => {
        setTrial(data.trial);
        setBalance(data.walletBalance);
      })
      .catch(console.error);
  }, [token]);

  const due = trial?.priceLkr ?? 0;
  const needsTopup = trial?.billing !== "PAYG" && due > 0 && balance < due;

  const summary = useMemo(() => {
    if (!trial) return null;
    return {
      name: trial.packageName || "Selected package",
      label: trial.priceLabel || (due > 0 ? `LKR ${due.toLocaleString()}` : "No upfront fee"),
      billing: trial.billing,
    };
  }, [trial, due]);

  async function activate() {
    if (!token) return;
    setBusy(true);
    setMsg("");
    try {
      const result = await api<{
        balance: number;
        trial: NonNullable<typeof trial>;
        charged?: number;
      }>("/billing/activate-package", { method: "POST", token });
      setTrial(result.trial);
      setBalance(result.balance);
      await refreshUser();
      setMsg(
        result.charged
          ? `Package activated. Charged LKR ${result.charged.toLocaleString()}.`
          : "Package activated. You can continue using TourPilot."
      );
      setTimeout(() => {
        navigate(user?.role === "AGENCY" ? "/dashboard/agency" : "/profile", { replace: true });
      }, 800);
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Could not activate package.");
    } finally {
      setBusy(false);
    }
  }

  async function runTopup(amount: number) {
    if (!token) throw new Error("Not signed in");
    const result = await api<{ balance: number }>("/wallet/topup", {
      method: "POST",
      token,
      body: JSON.stringify({ amount }),
    });
    setBalance(result.balance);
    await refreshUser();
    return result.balance;
  }

  if (!token) {
    return (
      <AuthLayout title="Activate package" subtitle="Log in to continue after your trial.">
        <p className="muted">
          <Link to="/login">Log in</Link> to activate your package.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Activate your package"
      subtitle={
        trial?.expiredUnpaid
          ? "Your 7-day free trial has ended. Pay for the package you chose to restore access."
          : "Activate anytime — during trial login fees are waived."
      }
    >
      {summary && (
        <div className="gov-form-card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>{summary.name}</h3>
          <p className="muted" style={{ marginBottom: 8 }}>
            Amount due: <strong>{summary.label}</strong>
            {summary.billing === "PAYG" ? " (sets your per-login fee)" : null}
            {summary.billing === "MONTHLY" ? " (monthly)" : null}
            {summary.billing === "ONE_TIME" ? " (one-time)" : null}
          </p>
          <p className="muted" style={{ margin: 0 }}>
            Wallet balance: LKR {balance.toLocaleString()}
          </p>
        </div>
      )}

      {needsTopup && (
        <WalletTopupPanel
          balance={balance}
          feeHint={due}
          onTopup={runTopup}
          className="login-wallet-panel--auth"
        />
      )}

      {msg && <p className={msg.includes("activated") ? "gov-status-msg" : "form-error"}>{msg}</p>}

      <button
        type="button"
        className="btn btn-primary"
        disabled={busy || needsTopup || trial?.activatedAt != null}
        onClick={() => void activate()}
      >
        {busy
          ? "Activating…"
          : trial?.billing === "PAYG"
            ? "Activate pay-as-you-go"
            : due > 0
              ? `Pay LKR ${due.toLocaleString()} & activate`
              : "Activate package"}
      </button>

      <p className="muted auth-footnote">
        Already paid? <Link to="/dashboard/agency">Open dashboard</Link>
      </p>
    </AuthLayout>
  );
}
