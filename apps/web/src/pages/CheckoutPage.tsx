import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { InvoiceDetail } from "../types/billing";
import { PayHereAutoSubmit } from "../components/billing/PayHereAutoSubmit";

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
  const [session, setSession] = useState<CheckoutSession | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token || !invoiceId) return;
    const q = paymentId ? `?payment=${encodeURIComponent(paymentId)}` : "";
    api<CheckoutSession>(`/invoices/${invoiceId}/checkout-session${q}`, { token })
      .then(setSession)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load checkout"));
  }, [token, invoiceId, paymentId]);

  if (!user || user.role !== "TOURIST") {
    return (
      <div className="page-narrow">
        <p>Please sign in as a tourist to complete payment.</p>
        <Link to="/login">Sign in</Link>
      </div>
    );
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
      ) : session.payHere ? (
        <PayHereAutoSubmit checkoutUrl={session.payHere.checkoutUrl} fields={session.payHere.fields} />
      ) : (
        <>
          <p className="field-error-note">
            {error || "PayHere is not ready for this invoice. Please try again or contact support."}
          </p>
          <Link to={session.tripRoomUrl} className="btn btn-ghost">
            Back to trip room
          </Link>
        </>
      )}
    </div>
  );
}

export function CheckoutReturnPage({ cancelled }: { cancelled?: boolean }) {
  const { invoiceId = "" } = useParams();
  const { token } = useAuth();
  const [tripRoomUrl, setTripRoomUrl] = useState(`/trips`);

  useEffect(() => {
    if (!token || !invoiceId) return;
    api<CheckoutSession>(`/invoices/${invoiceId}/checkout-session`, { token })
      .then((s) => {
        if (s.tripRoomUrl) setTripRoomUrl(s.tripRoomUrl.replace(/^https?:\/\/[^/]+/, "") || "/trips");
      })
      .catch(() => {
        /* keep /trips fallback */
      });
  }, [token, invoiceId]);

  return (
    <div className="page-narrow checkout-page">
      <h1>{cancelled ? "Payment cancelled" : "Payment received"}</h1>
      <p className="muted">
        {cancelled
          ? "You cancelled the payment. You can try again from your trip room invoice."
          : "If payment succeeded, your invoice will show as paid shortly after confirmation from PayHere."}
      </p>
      <Link to={tripRoomUrl} className="btn btn-primary">
        Back to trip room
      </Link>
    </div>
  );
}
