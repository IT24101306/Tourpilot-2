import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { WalletTopupPanel } from "../../components/wallet/WalletTopupPanel";
import { formatCredits } from "../../lib/walletLedger";

export function BillingPaymentMethodsPage() {
  const { token, user, refreshUser } = useAuth();
  const [balance, setBalance] = useState(user?.walletBalance ?? 0);

  useEffect(() => {
    setBalance(user?.walletBalance ?? 0);
  }, [user?.walletBalance]);

  async function handleTopup(amount: number) {
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
        <h1 className="account-billing-title">Payment methods</h1>
        <div className="account-billing-balance-pill" title="Platform wallet credits">
          Credits balance: <strong>{formatCredits(balance)}</strong>
        </div>
      </div>

      <div className="account-billing-status-bar">
        <span className="account-billing-status-bar__ok" aria-hidden="true">
          ✓
        </span>
        <p>
          You have <strong>1 active</strong> payment method.
        </p>
      </div>

      <div className="account-billing-card">
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
        <div className="account-billing-card">
          <h2 className="account-billing-card__heading">Add credits</h2>
          <WalletTopupPanel balance={balance} onTopup={handleTopup} emphasize />
        </div>
      ) : null}
    </div>
  );
}
