import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { WalletTopupPanel } from "../../components/wallet/WalletTopupPanel";
import { formatCredits } from "../../lib/walletLedger";

export function BillingPaymentMethodsPage() {
  const { token, user, refreshUser } = useAuth();
  const [searchParams] = useSearchParams();
  const [balance, setBalance] = useState(user?.walletBalance ?? 0);
  const [status, setStatus] = useState("");

  useEffect(() => {
    setBalance(user?.walletBalance ?? 0);
  }, [user?.walletBalance]);

  useEffect(() => {
    if (searchParams.get("topup") === "1") {
      setStatus("Payment received. Credits appear after PayHere confirms.");
      void refreshUser();
    }
    if (searchParams.get("cancelled") === "1") {
      setStatus("Top-up cancelled.");
    }
  }, [searchParams, refreshUser]);

  async function handleTopup(amount: number) {
    if (!token) throw new Error("Not signed in");
    return api<{ mode: "payhere"; checkoutUrl: string; fields: Record<string, string> }>("/wallet/topup", {
      method: "POST",
      token,
      body: JSON.stringify({ amount }),
    });
  }

  return (
    <div className="account-billing-page">
      <nav className="account-billing-crumbs" aria-label="Breadcrumb">
        <Link to="/profile">Account</Link>
        <span aria-hidden="true">/</span>
        <span>Billing</span>
        <span aria-hidden="true">/</span>
        <span>Payment methods</span>
      </nav>

      <div className="account-billing-title-row">
        <div>
          <h1 className="account-billing-title">Payment methods</h1>
          <p className="account-billing-lead">
            TourPilot Credits pay platform login fees. Add credits with PayHere — cards are not stored
            on TourPilot.
          </p>
        </div>
        <div className="account-billing-balance-pill" title="Platform wallet credits">
          Credits balance: <strong>{formatCredits(balance)}</strong>
        </div>
      </div>

      {status ? <p className="entity-status">{status}</p> : null}

      <div className="account-billing-status-bar">
        <span className="account-billing-status-bar__ok" aria-hidden="true">
          ✓
        </span>
        <p>
          You have <strong>1 active</strong> payment method.
        </p>
      </div>

      <div className="account-billing-card">
        <p className="account-billing-card__eyebrow">Methods</p>
        <h2 className="account-billing-card__heading">Payment method list</h2>
        <ul className="account-billing-methods">
          <li className="account-billing-method">
            <div>
              <strong>TourPilot Credits</strong>
              <p className="account-billing-method__meta">
                Wallet · {formatCredits(balance)} available{" "}
                <span className="account-billing-badge">Default method</span>
              </p>
            </div>
          </li>
        </ul>
        <p className="muted account-billing-note">
          Card payments for plan activation and renewal are completed securely via PayHere at
          checkout. Cards are not stored on TourPilot.
        </p>
      </div>

      {token ? (
        <div className="account-billing-card account-billing-wallet-box">
          <p className="account-billing-card__eyebrow">Wallet</p>
          <h2 className="account-billing-card__heading">Add credits</h2>
          <p className="account-billing-card__lead">Top up via PayHere. Credits appear after payment is confirmed.</p>
          <WalletTopupPanel balance={balance} onTopup={handleTopup} emphasize />
        </div>
      ) : null}
    </div>
  );
}
