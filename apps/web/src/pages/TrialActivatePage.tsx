import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { AuthLayout } from "../components/AuthLayout";
import { PayHereAutoSubmit } from "../components/billing/PayHereAutoSubmit";

export function TrialActivatePage() {
  const { token, user } = useAuth();
  const [trial, setTrial] = useState(user?.trial ?? null);
  const [error, setError] = useState("");
  const [payHere, setPayHere] = useState<{ checkoutUrl: string; fields: Record<string, string> } | null>(
    null
  );
  const [activated, setActivated] = useState(false);

  useEffect(() => {
    if (!token) return;
    api<{ trial: NonNullable<typeof trial> }>("/billing/trial", { token })
      .then((data) => setTrial(data.trial))
      .catch(console.error);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api<{
      mode: "payhere" | "activated";
      checkoutUrl?: string;
      fields?: Record<string, string>;
    }>("/billing/activate-package", { method: "POST", token })
      .then((result) => {
        if (cancelled) return;
        if (result.mode === "activated") {
          setActivated(true);
          return;
        }
        if (result.checkoutUrl && result.fields) {
          setPayHere({ checkoutUrl: result.checkoutUrl, fields: result.fields });
        } else {
          setError("Could not start PayHere checkout.");
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Could not start checkout");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const due = trial?.priceLkr ?? 0;
  const summary = useMemo(() => {
    if (!trial) return null;
    return {
      name: trial.packageName || "Selected package",
      label: trial.priceLabel || (due > 0 ? `LKR ${due.toLocaleString()}` : "No upfront fee"),
    };
  }, [trial, due]);

  if (!token) {
    return (
      <AuthLayout fullScreen title="Activate package" subtitle="Log in to continue after your trial.">
        <p className="muted">
          <Link to="/login">Log in</Link> to activate your package.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      fullScreen
      title="Activate your package"
      subtitle={
        trial?.expiredUnpaid
          ? "Your free trial has ended. Pay with PayHere to keep using TourPilot."
          : "Complete payment with PayHere to activate your package."
      }
    >
      {summary ? (
        <p className="muted">
          {summary.name} · {summary.label}
        </p>
      ) : null}
      {activated ? (
        <p>
          Package activated. <Link to="/dashboard/agency">Open dashboard</Link>
        </p>
      ) : payHere ? (
        <PayHereAutoSubmit checkoutUrl={payHere.checkoutUrl} fields={payHere.fields} />
      ) : error ? (
        <p className="form-error">{error}</p>
      ) : (
        <p className="muted">Preparing PayHere checkout…</p>
      )}

      <p className="muted auth-footnote">
        Already activated? <Link to="/dashboard/agency">Open dashboard</Link>
      </p>
    </AuthLayout>
  );
}
