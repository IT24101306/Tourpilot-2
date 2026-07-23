import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
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
  const { token, refreshUser } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [data, setData] = useState<SubscriptionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    setError("");
    setLoading(true);
    try {
      const res = await api<SubscriptionPayload>("/subscription", { token });
      setData(res);
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
    if (searchParams.get("paid") === "1" || searchParams.get("activated") === "1") {
      setStatus("Subscription updated successfully.");
      void refreshUser();
      void load();
    }
  }, [searchParams, refreshUser, load]);

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

  async function startCheckout() {
    if (!token) return;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const res = await api<{
        mode: string;
        redirectUrl?: string;
        paymentId?: string;
      }>("/subscription/checkout", { method: "POST", token });

      if (res.mode === "activated") {
        setStatus("Package activated.");
        await refreshUser();
        await load();
        return;
      }
      if (res.redirectUrl) {
        const path = res.redirectUrl.replace(/^https?:\/\/[^/]+/, "");
        navigate(path || `/profile/billing/subscriptions/checkout?payment=${res.paymentId}`);
        return;
      }
      setError("Checkout could not be started.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Checkout failed");
    } finally {
      setBusy(false);
    }
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

  return (
    <div className="account-billing-page">
      <nav className="account-billing-crumbs" aria-label="Breadcrumb">
        <Link to="/profile">Account</Link>
        <span aria-hidden="true">/</span>
        <span>Billing</span>
        <span aria-hidden="true">/</span>
        <span>Subscriptions</span>
      </nav>
      <h1 className="account-billing-title">Subscriptions</h1>

      {status ? <p className="entity-status">{status}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

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
                  onClick={() => void startCheckout()}
                >
                  {busy ? "Working…" : ctaLabel}
                </button>
              </div>
            ) : trial.billing === "MONTHLY" ? (
              <div className="account-billing-fields__actions">
                <button
                  type="button"
                  className="btn btn-teal"
                  disabled={busy}
                  onClick={() => void startCheckout()}
                >
                  {busy ? "Working…" : "Renew now"}
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
  const { token, refreshUser } = useAuth();
  const [searchParams] = useSearchParams();
  const paymentId = searchParams.get("payment") ?? "";
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [session, setSession] = useState<{
    mode: "payhere" | "demo";
    payment: { id: string; status: string; amountLkr: number; packageName: string };
    payHere: { checkoutUrl: string; fields: Record<string, string> } | null;
  } | null>(null);
  const autoSubmitRef = useRef(false);

  useEffect(() => {
    if (!token || !paymentId) return;
    api<NonNullable<typeof session>>(
      `/subscription/checkout-session?payment=${encodeURIComponent(paymentId)}`,
      { token }
    )
      .then(setSession)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load checkout"));
  }, [token, paymentId]);

  useEffect(() => {
    if (!session?.payHere || autoSubmitRef.current) return;
    if (session.mode !== "payhere") return;
    autoSubmitRef.current = true;
    const form = document.getElementById("sub-payhere-form") as HTMLFormElement | null;
    form?.submit();
  }, [session]);

  async function completeDemo(e: FormEvent) {
    e.preventDefault();
    if (!token || !paymentId) return;
    setWorking(true);
    setError("");
    try {
      const result = await api<{ redirectUrl: string }>("/subscription/demo-complete", {
        method: "POST",
        token,
        body: JSON.stringify({ paymentId }),
      });
      await refreshUser();
      const path = result.redirectUrl.replace(/^https?:\/\/[^/]+/, "");
      navigate(path || "/profile/billing/subscriptions?paid=1");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Payment failed");
    } finally {
      setWorking(false);
    }
  }

  if (error && !session) {
    return (
      <div className="account-billing-page">
        <h1 className="account-billing-title">Checkout</h1>
        <p className="form-error">{error}</p>
        <Link to="/profile/billing/subscriptions">Back to subscriptions</Link>
      </div>
    );
  }

  if (!session) return <p className="muted">Preparing checkout…</p>;

  if (session.mode === "payhere" && session.payHere) {
    return (
      <div className="account-billing-page">
        <h1 className="account-billing-title">Redirecting to PayHere…</h1>
        <form id="sub-payhere-form" method="POST" action={session.payHere.checkoutUrl}>
          {Object.entries(session.payHere.fields).map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))}
        </form>
      </div>
    );
  }

  return (
    <div className="account-billing-page">
      <h1 className="account-billing-title">Complete payment</h1>
      <div className="account-billing-card">
        <p>
          <strong>{session.payment.packageName}</strong>
        </p>
        <p>Amount: {formatCredits(session.payment.amountLkr)}</p>
        <p className="muted">Demo checkout (PayHere not configured).</p>
        {error ? <p className="form-error">{error}</p> : null}
        <form onSubmit={completeDemo}>
          <button type="submit" className="btn btn-primary" disabled={working}>
            {working ? "Processing…" : "Pay now (demo)"}
          </button>
        </form>
      </div>
    </div>
  );
}

export function BillingSubscriptionReturnPage({ cancelled = false }: { cancelled?: boolean }) {
  const { token, refreshUser } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const paymentId = searchParams.get("payment") ?? "";

  useEffect(() => {
    if (cancelled) {
      navigate("/profile/billing/subscriptions?cancelled=1", { replace: true });
      return;
    }
    void (async () => {
      await refreshUser();
      if (token && paymentId) {
        try {
          await api(`/subscription/checkout-session?payment=${encodeURIComponent(paymentId)}`, {
            token,
          });
        } catch {
          /* ignore */
        }
      }
      navigate("/profile/billing/subscriptions?paid=1", { replace: true });
    })();
  }, [cancelled, navigate, refreshUser, token, paymentId]);

  return <p className="muted">Returning to subscriptions…</p>;
}
