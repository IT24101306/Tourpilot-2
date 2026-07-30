import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { agencyFeaturesOf, useAuth } from "../../context/AuthContext";
import { PaymentGatewayPendingNotice } from "../../components/billing/PaymentGatewayPendingNotice";
import { WalletTopupPanel } from "../../components/wallet/WalletTopupPanel";
import { formatCredits } from "../../lib/walletLedger";

type SubscriptionPayload = {
  trial: {
    active: boolean;
    expiredUnpaid: boolean;
    endsAt: string | null;
    daysRemaining: number | null;
    packageId: string | null;
    packageName: string | null;
    priceLkr: number | null;
    priceLabel: string | null;
    billing: string | null;
    activatedAt: string | null;
  };
  autoRenew: boolean;
  periodEnd: string | null;
  walletBalance: number;
};

export function BillingSubscriptionsPage() {
  const { token, user, refreshUser } = useAuth();
  const features = agencyFeaturesOf(user);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [data, setData] = useState<SubscriptionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [walletBalance, setWalletBalance] = useState(user?.walletBalance ?? 0);

  const load = useCallback(async () => {
    if (!token) return;
    setError("");
    setLoading(true);
    try {
      const res = await api<SubscriptionPayload>("/subscription", { token });
      setData(res);
      setWalletBalance(res.walletBalance);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load subscription");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setWalletBalance(user?.walletBalance ?? 0);
  }, [user?.walletBalance]);

  useEffect(() => {
    if (searchParams.get("cancelled") === "1") {
      setStatus("Checkout cancelled.");
    }
  }, [searchParams]);

  async function toggleAutoRenew(next: boolean) {
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      const res = await api<{ autoRenew: boolean }>("/subscription/auto-renew", {
        method: "PATCH",
        token,
        body: JSON.stringify({ autoRenew: next }),
      });
      setData((prev) => (prev ? { ...prev, autoRenew: res.autoRenew } : prev));
      await refreshUser();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update auto-renewal");
    } finally {
      setBusy(false);
    }
  }

  async function handleTopup(amount: number) {
    if (!token) throw new Error("Not signed in");
    const result = await api<{ balance: number }>("/wallet/topup", {
      method: "POST",
      token,
      body: JSON.stringify({ amount }),
    });
    setWalletBalance(result.balance);
    setData((prev) => (prev ? { ...prev, walletBalance: result.balance } : prev));
    await refreshUser();
    return result.balance;
  }

  function openActivationCheckout() {
    navigate("/profile/billing/subscriptions/checkout");
  }

  if (loading) return <p className="muted">Loading subscription…</p>;
  if (error && !data) return <p className="form-error">{error}</p>;
  if (!data) return null;

  const trial = data.trial;
  const name = trial.packageName || "No plan selected";
  const matches =
    !query.trim() ||
    name.toLowerCase().includes(query.trim().toLowerCase()) ||
    (trial.packageId || "").toLowerCase().includes(query.trim().toLowerCase());

  const expiryLabel = trial.active
    ? trial.endsAt
      ? new Date(trial.endsAt).toISOString().slice(0, 10)
      : "—"
    : data.periodEnd
      ? new Date(data.periodEnd).toISOString().slice(0, 10)
      : trial.activatedAt
        ? "Active"
        : "—";

  const priceLabel =
    trial.priceLabel ||
    (trial.priceLkr != null && trial.priceLkr > 0
      ? formatCredits(trial.priceLkr)
      : "Pay as you go");

  const ctaLabel = trial.activatedAt && !trial.active ? "Renew" : "Activate";
  const showWalletBox = user?.role === "AGENCY" ? features.walletTopup : true;

  return (
    <div className="account-billing-page">
      <nav className="account-billing-crumbs" aria-label="Breadcrumb">
        <Link to="/profile">Account</Link>
        <span aria-hidden="true">/</span>
        <span>Billing</span>
        <span aria-hidden="true">/</span>
        <span>Subscriptions</span>
      </nav>

      <div className="account-billing-title-row">
        <h1 className="account-billing-title">Subscriptions</h1>
        <div className="account-billing-balance-pill" title="Platform wallet credits">
          Credits balance: <strong>{formatCredits(walletBalance)}</strong>
        </div>
      </div>

      {status ? <p className="entity-status">{status}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      {showWalletBox && token ? (
        <div className="account-billing-card account-billing-wallet-box">
          <h2 className="account-billing-card__heading">Wallet</h2>
          <WalletTopupPanel
            balance={walletBalance}
            onTopup={handleTopup}
            feeHint={user?.loginFee}
            emphasize
          />
        </div>
      ) : null}

      <div className="account-billing-card">
        <label className="account-billing-search">
          <span className="sr-only">Search subscriptions</span>
          <input
            type="search"
            placeholder="Search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>

        {!trial.packageId ? (
          <p className="muted account-billing-empty">
            No package on this account yet. Choose a plan from{" "}
            <Link to="/#pricing">pricing</Link> when you register, or contact support.
          </p>
        ) : !matches ? (
          <p className="muted account-billing-empty">No subscriptions match “{query}”.</p>
        ) : (
          <dl className="account-billing-fields">
            <div>
              <dt>Subscription</dt>
              <dd>
                <strong>{name}</strong>
                {trial.packageId ? (
                  <span className="account-billing-fields__sub">{trial.packageId}</span>
                ) : null}
              </dd>
            </div>

            {trial.active ? (
              <div className="account-billing-trial">
                <dt>Trial period</dt>
                <dd>
                  {trial.daysRemaining != null
                    ? `Trial ends in ${trial.daysRemaining} day${trial.daysRemaining === 1 ? "" : "s"}`
                    : "Free trial active"}
                  {trial.endsAt ? (
                    <span className="account-billing-fields__sub">
                      Ends {new Date(trial.endsAt).toLocaleDateString()}
                    </span>
                  ) : null}
                </dd>
              </div>
            ) : null}

            <div>
              <dt>{trial.active ? "Trial end date" : "Expiration date"}</dt>
              <dd>{expiryLabel}</dd>
            </div>

            <div>
              <dt>Renewal price</dt>
              <dd>{priceLabel}</dd>
            </div>

            <div className="account-billing-fields__toggle-row">
              <dt>Auto-renewal</dt>
              <dd>
                <label className="account-billing-switch">
                  <input
                    type="checkbox"
                    checked={data.autoRenew}
                    disabled={busy}
                    onChange={(e) => void toggleAutoRenew(e.target.checked)}
                  />
                  <span className="account-billing-switch__ui" aria-hidden="true" />
                  <span className="sr-only">Auto-renewal</span>
                </label>
              </dd>
            </div>

            {(trial.active || trial.expiredUnpaid || !trial.activatedAt) && trial.packageId ? (
              <div className="account-billing-fields__actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={openActivationCheckout}
                >
                  {ctaLabel}
                </button>
              </div>
            ) : trial.billing === "MONTHLY" ? (
              <div className="account-billing-fields__actions">
                <button
                  type="button"
                  className="btn btn-teal"
                  disabled={busy}
                  onClick={openActivationCheckout}
                >
                  Renew now
                </button>
              </div>
            ) : null}
          </dl>
        )}
      </div>
    </div>
  );
}
export function BillingSubscriptionCheckoutPage() {
  const { token } = useAuth();
  const [data, setData] = useState<SubscriptionPayload | null>(null);

  useEffect(() => {
    if (!token) return;
    api<SubscriptionPayload>("/subscription", { token })
      .then(setData)
      .catch(() => setData(null));
  }, [token]);

  const trial = data?.trial;
  const amountLabel =
    trial?.priceLabel ||
    (trial?.priceLkr != null && trial.priceLkr > 0
      ? formatCredits(trial.priceLkr)
      : trial
        ? "Pay as you go"
        : null);

  return (
    <div className="account-billing-page">
      <nav className="account-billing-crumbs" aria-label="Breadcrumb">
        <Link to="/profile">Account</Link>
        <span aria-hidden="true">/</span>
        <Link to="/profile/billing/subscriptions">Subscriptions</Link>
        <span aria-hidden="true">/</span>
        <span>Checkout</span>
      </nav>
      <h1 className="account-billing-title">Activate package</h1>
      <div className="account-billing-card">
        <PaymentGatewayPendingNotice
          packageName={trial?.packageName}
          amountLabel={amountLabel}
        />
        <p className="muted" style={{ marginTop: "1.25rem", marginBottom: 0 }}>
          <Link to="/profile/billing/subscriptions">← Back to subscriptions</Link>
        </p>
      </div>
    </div>
  );
}

export function BillingSubscriptionReturnPage({ cancelled = false }: { cancelled?: boolean }) {
  const navigate = useNavigate();

  useEffect(() => {
    navigate(
      cancelled
        ? "/profile/billing/subscriptions?cancelled=1"
        : "/profile/billing/subscriptions/checkout",
      { replace: true }
    );
  }, [cancelled, navigate]);

  return <p className="muted">Returning to subscriptions…</p>;
}
