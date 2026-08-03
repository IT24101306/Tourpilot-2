import { useEffect, useMemo, useState } from "react";
import type { PackageBilling, TrialStatusView } from "@tourpilot/shared";

export type AdminAgencySubscription = {
  ownerId: string;
  walletBalance: number;
  autoRenew: boolean;
  periodEnd: string | null;
  loginFeeLkr: number | null;
  trial: TrialStatusView;
};

export type CatalogPackage = {
  id: string;
  name: string;
  priceLkr: number;
  priceLabel: string;
  billing: PackageBilling | string;
};

export type AgencySubscriptionSavePayload = {
  packageId: string | null;
  packageName: string | null;
  priceLkr: number | null;
  priceLabel: string | null;
  billing: PackageBilling | null;
  trialEndsAt: string | null;
  subscriptionPeriodEnd: string | null;
  subscriptionAutoRenew: boolean;
  activate?: boolean;
  deactivate?: boolean;
  restartTrial?: boolean;
  extendTrialDays?: number;
  applyTrialFeatures?: boolean;
};

type Props = {
  agencyName: string;
  open: boolean;
  loading: boolean;
  subscription: AdminAgencySubscription | null;
  catalogPackages: CatalogPackage[];
  onClose: () => void;
  onSave: (payload: AgencySubscriptionSavePayload) => void;
};

const BILLINGS: PackageBilling[] = ["MONTHLY", "ONE_TIME", "PAYG", "CUSTOM"];

function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function fromDateInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Store as noon UTC to avoid timezone day-shift surprises for date-only admin input.
  return `${trimmed}T12:00:00.000Z`;
}

function statusSummary(trial: TrialStatusView, periodEnd: string | null): string {
  if (trial.activatedAt) {
    if (periodEnd) {
      return `Active · period ends ${new Date(periodEnd).toLocaleDateString()}`;
    }
    return "Active (activated)";
  }
  if (trial.active) {
    return trial.daysRemaining != null
      ? `Trial · ${trial.daysRemaining} day(s) left`
      : "Trial active";
  }
  if (trial.expiredUnpaid) return "Trial expired · unpaid";
  if (trial.packageId) return "Package selected · not activated";
  return "No package";
}

export function AgencySubscriptionModal({
  agencyName,
  open,
  loading,
  subscription,
  catalogPackages,
  onClose,
  onSave,
}: Props) {
  const [packageId, setPackageId] = useState("");
  const [packageName, setPackageName] = useState("");
  const [priceLkr, setPriceLkr] = useState("0");
  const [priceLabel, setPriceLabel] = useState("");
  const [billing, setBilling] = useState<PackageBilling>("MONTHLY");
  const [trialEndsAt, setTrialEndsAt] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [autoRenew, setAutoRenew] = useState(false);
  const [applyTrialFeatures, setApplyTrialFeatures] = useState(false);
  const [extendDays, setExtendDays] = useState("7");

  useEffect(() => {
    if (!open || !subscription) return;
    const t = subscription.trial;
    setPackageId(t.packageId ?? "");
    setPackageName(t.packageName ?? "");
    setPriceLkr(String(t.priceLkr ?? 0));
    setPriceLabel(t.priceLabel ?? "");
    setBilling((t.billing as PackageBilling) || "MONTHLY");
    setTrialEndsAt(toDateInput(t.endsAt));
    setPeriodEnd(toDateInput(subscription.periodEnd));
    setAutoRenew(subscription.autoRenew);
    setApplyTrialFeatures(false);
    setExtendDays("7");
  }, [open, subscription]);

  const catalogById = useMemo(() => {
    const map = new Map(catalogPackages.map((p) => [p.id, p]));
    return map;
  }, [catalogPackages]);

  if (!open || !subscription) return null;

  const trial = subscription.trial;
  const isActivated = Boolean(trial.activatedAt);

  function applyCatalogPackage(id: string) {
    setPackageId(id);
    const pkg = catalogById.get(id);
    if (!pkg) return;
    setPackageName(pkg.name);
    setPriceLkr(String(pkg.priceLkr));
    setPriceLabel(pkg.priceLabel);
    setBilling((pkg.billing as PackageBilling) || "MONTHLY");
  }

  function basePayload(): AgencySubscriptionSavePayload {
    const price = Math.max(0, Math.round(Number(priceLkr) || 0));
    return {
      packageId: packageId.trim() || null,
      packageName: packageName.trim() || null,
      priceLkr: packageId.trim() || packageName.trim() ? price : null,
      priceLabel: priceLabel.trim() || null,
      billing: packageId.trim() || packageName.trim() ? billing : null,
      trialEndsAt: fromDateInput(trialEndsAt),
      subscriptionPeriodEnd: fromDateInput(periodEnd),
      subscriptionAutoRenew: autoRenew,
      applyTrialFeatures: applyTrialFeatures || undefined,
    };
  }

  return (
    <div className="gov-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="gov-modal gov-features-modal gov-subscription-modal"
        role="dialog"
        aria-labelledby="agency-subscription-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="gov-features-modal__head">
          <h3 id="agency-subscription-title">Manage subscription</h3>
          <p className="muted">{agencyName}</p>
        </header>

        <p className="gov-subscription-status">
          <strong>{statusSummary(trial, subscription.periodEnd)}</strong>
          <span className="muted">
            Wallet {subscription.walletBalance.toLocaleString("en-LK")} credits
            {isActivated && trial.activatedAt
              ? ` · Activated ${new Date(trial.activatedAt).toLocaleDateString()}`
              : ""}
          </span>
        </p>

        <div className="gov-subscription-form">
          <label>
            Catalog package
            <select
              className="agency-filter"
              value={catalogById.has(packageId) ? packageId : ""}
              disabled={loading}
              onChange={(e) => {
                if (e.target.value) applyCatalogPackage(e.target.value);
              }}
            >
              <option value="">Custom / keep current</option>
              {catalogPackages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.priceLabel}
                </option>
              ))}
            </select>
          </label>

          <div className="gov-subscription-grid">
            <label>
              Package id
              <input
                value={packageId}
                disabled={loading}
                onChange={(e) => setPackageId(e.target.value)}
                placeholder="starter"
              />
            </label>
            <label>
              Package name
              <input
                value={packageName}
                disabled={loading}
                onChange={(e) => setPackageName(e.target.value)}
                placeholder="Starter"
              />
            </label>
            <label>
              Price (LKR / credits)
              <input
                type="number"
                min={0}
                value={priceLkr}
                disabled={loading}
                onChange={(e) => setPriceLkr(e.target.value)}
              />
            </label>
            <label>
              Price label
              <input
                value={priceLabel}
                disabled={loading}
                onChange={(e) => setPriceLabel(e.target.value)}
                placeholder="LKR 5,000"
              />
            </label>
            <label>
              Billing
              <select
                className="agency-filter"
                value={billing}
                disabled={loading}
                onChange={(e) => setBilling(e.target.value as PackageBilling)}
              >
                {BILLINGS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Trial end date
              <input
                type="date"
                value={trialEndsAt}
                disabled={loading}
                onChange={(e) => setTrialEndsAt(e.target.value)}
              />
            </label>
            <label>
              Period end date
              <input
                type="date"
                value={periodEnd}
                disabled={loading}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </label>
            <label className="gov-subscription-check">
              <input
                type="checkbox"
                checked={autoRenew}
                disabled={loading}
                onChange={(e) => setAutoRenew(e.target.checked)}
              />
              Auto-renewal
            </label>
            <label className="gov-subscription-check">
              <input
                type="checkbox"
                checked={applyTrialFeatures}
                disabled={loading}
                onChange={(e) => setApplyTrialFeatures(e.target.checked)}
              />
              Unlock all trial features on save
            </label>
          </div>
        </div>

        <div className="gov-subscription-quick">
          <label>
            Extend trial (days)
            <input
              type="number"
              min={1}
              max={365}
              value={extendDays}
              disabled={loading}
              onChange={(e) => setExtendDays(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={loading}
            onClick={() => {
              const days = Math.max(1, Math.round(Number(extendDays) || 7));
              onSave({ ...basePayload(), extendTrialDays: days });
            }}
          >
            Extend trial
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={loading}
            onClick={() => onSave({ ...basePayload(), restartTrial: true, applyTrialFeatures: true })}
          >
            Restart 7-day trial
          </button>
          {!isActivated ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={loading || (!packageId.trim() && !packageName.trim())}
              onClick={() => onSave({ ...basePayload(), activate: true })}
            >
              Activate (mark paid)
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-ghost gov-btn-danger-outline"
              disabled={loading}
              onClick={() => onSave({ ...basePayload(), deactivate: true })}
            >
              Clear activation
            </button>
          )}
        </div>

        <p className="gov-features-modal__note muted">
          Activation does not charge the agency wallet — use this after they pay you offline. Package
          changes apply on their next session refresh.
        </p>

        <div className="gov-form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={loading}
            onClick={() => onSave(basePayload())}
          >
            {loading ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
