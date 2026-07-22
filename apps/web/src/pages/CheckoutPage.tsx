import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { InvoiceDetail } from "../types/billing";

type CheckoutSession = {
  invoice: InvoiceDetail;
  payment: { id: string; status: string; provider: string; amountLkr: number } | null;
  mode: "payhere" | "demo";
  payHere: { checkoutUrl: string; fields: Record<string, string> } | null;
  agencyName: string;
  tripRoomUrl: string;
};

export function CheckoutPage() {
  const { invoiceId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const paymentId = searchParams.get("payment") ?? undefined;
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [session, setSession] = useState<CheckoutSession | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const autoSubmitRef = useRef(false);

  useEffect(() => {
    if (!token || !invoiceId) return;
    const q = paymentId ? `?payment=${encodeURIComponent(paymentId)}` : "";
    api<CheckoutSession>(`/invoices/${invoiceId}/checkout-session${q}`, { token })
      .then(setSession)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load checkout"));
  }, [token, invoiceId, paymentId]);

  useEffect(() => {
    if (!session?.payHere || autoSubmitRef.current) return;
    if (session.mode !== "payhere") return;
    autoSubmitRef.current = true;
    const form = document.getElementById("payhere-checkout-form") as HTMLFormElement | null;
    form?.submit();
  }, [session]);

  if (!user || user.role !== "TOURIST") {
    return (
      <div className="page-narrow">
        <p>Please sign in as a tourist to complete payment.</p>
        <Link to="/login">Sign in</Link>
      </div>
    );
  }

  async function completeDemo(e: FormEvent) {
    e.preventDefault();
    if (!token || !session?.payment) return;
    setWorking(true);
    setError("");
    try {
      const result = await api<{ redirectUrl: string }>(`/invoices/${invoiceId}/demo-complete`, {
        method: "POST",
        token,
        body: JSON.stringify({ paymentId: session.payment.id }),
      });
      const path = result.redirectUrl.replace(/^https?:\/\/[^/]+/, "");
      navigate(path || session.tripRoomUrl);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Payment failed");
    } finally {
      setWorking(false);
    }
  }

  if (error && !session) {
    return (
      <div className="page-narrow checkout-page">
        <h1>Checkout</h1>
        <p className="field-error-note">{error}</p>
        <Link to="/trips" className="btn btn-ghost">
          Back to trips
        </Link>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="page-narrow checkout-page">
        <p className="muted">Preparing payment…</p>
      </div>
    );
  }

  const { invoice } = session;

  return (
    <div className="page-narrow checkout-page">
      <h1>Pay invoice {invoice.invoiceNumber}</h1>
      <p className="muted">
        {session.agencyName} · Total due{" "}
        <strong>LKR {invoice.totalLkr.toLocaleString()}</strong>
      </p>

      {invoice.status === "PAID" ? (
        <>
          <p className="tour-status">This invoice is already paid.</p>
          <Link to={session.tripRoomUrl} className="btn btn-primary">
            Back to trip room
          </Link>
        </>
      ) : session.mode === "payhere" && session.payHere ? (
        <>
          <p className="muted">Redirecting you to PayHere…</p>
          <form id="payhere-checkout-form" method="post" action={session.payHere.checkoutUrl}>
            {Object.entries(session.payHere.fields).map(([key, value]) => (
              <input key={key} type="hidden" name={key} value={value} />
            ))}
            <button type="submit" className="btn btn-primary">
              Continue to PayHere
            </button>
          </form>
        </>
      ) : (
        <form onSubmit={completeDemo} className="checkout-demo-card">
          <p>
            Payment gateway credentials are not configured yet. This is a <strong>demo checkout</strong>{" "}
            so you can verify the voucher → pay flow. Once PayHere merchant keys are set on the
            server, tourists will be sent to the real gateway automatically.
          </p>
          <p>
            Amount: <strong>LKR {invoice.totalLkr.toLocaleString()}</strong>
          </p>
          {error && <p className="field-error-note">{error}</p>}
          <div className="dialog-actions" style={{ justifyContent: "flex-start" }}>
            <Link to={session.tripRoomUrl} className="btn btn-ghost">
              Cancel
            </Link>
            <button type="submit" className="btn btn-primary" disabled={working || !session.payment}>
              {working ? "Processing…" : "Complete demo payment"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function CheckoutReturnPage({ cancelled }: { cancelled?: boolean }) {
  const { invoiceId = "" } = useParams();
  return (
    <div className="page-narrow checkout-page">
      <h1>{cancelled ? "Payment cancelled" : "Payment received"}</h1>
      <p className="muted">
        {cancelled
          ? "You cancelled the payment. You can try again from your trip room invoice."
          : "If payment succeeded, your invoice will show as paid shortly after confirmation from the gateway."}
      </p>
      <Link to={`/trips?room=${invoiceId}`} className="btn btn-primary">
        Back to trip room
      </Link>
    </div>
  );
}
