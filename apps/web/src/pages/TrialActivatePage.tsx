import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { AuthLayout } from "../components/AuthLayout";
import { PaymentGatewayPendingNotice } from "../components/billing/PaymentGatewayPendingNotice";

export function TrialActivatePage() {
  const { token, user } = useAuth();
  const [trial, setTrial] = useState(user?.trial ?? null);

  useEffect(() => {
    if (!token) return;
    api<{ trial: NonNullable<typeof trial> }>("/billing/trial", { token })
      .then((data) => setTrial(data.trial))
      .catch(console.error);
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
      <AuthLayout
        fullScreen
        title="Activate package"
        subtitle="Log in to continue after your trial."
      >
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
          ? "Your 7-day free trial has ended. Contact the administrator to activate your package."
          : "Online payments are not available yet — contact the administrator to activate."
      }
    >
      <PaymentGatewayPendingNotice
        packageName={summary?.name}
        amountLabel={summary?.label}
      />

      <p className="muted auth-footnote">
        Already activated? <Link to="/dashboard/agency">Open dashboard</Link>
      </p>
    </AuthLayout>
  );
}
