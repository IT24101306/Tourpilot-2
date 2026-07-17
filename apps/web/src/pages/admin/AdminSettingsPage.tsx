import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { UserRole } from "@tourpilot/shared";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useConfirmAction } from "../../components/confirm/ConfirmActionContext";
import { ModuleHeader } from "../../components/module/ModuleHeader";

type PlatformSettings = {
  loginFees: Record<UserRole, number>;
  inquiryExpiryDays: number;
  webAppUrl: string;
  emailFrom: string;
  walletTopupMinLkr: number;
  walletTopupMaxLkr: number | null;
  updatedAt: string | null;
};

const FEE_ROLES: UserRole[] = ["TOURIST", "AGENCY", "INFLUENCER", "DRIVER", "ADMIN"];

export function AdminSettingsPage() {
  const { token } = useAuth();
  const { requestConfirm } = useConfirmAction();
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [fees, setFees] = useState<Record<UserRole, string>>({
    TOURIST: "0",
    AGENCY: "50",
    INFLUENCER: "25",
    DRIVER: "25",
    ADMIN: "0",
  });
  const [inquiryExpiryDays, setInquiryExpiryDays] = useState("14");
  const [webAppUrl, setWebAppUrl] = useState("");
  const [emailFrom, setEmailFrom] = useState("");
  const [topupMin, setTopupMin] = useState("100");
  const [topupMax, setTopupMax] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!token) return;
    api<PlatformSettings>("/admin/settings", { token })
      .then((data) => {
        setSettings(data);
        setFees({
          TOURIST: String(data.loginFees.TOURIST),
          AGENCY: String(data.loginFees.AGENCY),
          INFLUENCER: String(data.loginFees.INFLUENCER),
          DRIVER: String(data.loginFees.DRIVER),
          ADMIN: String(data.loginFees.ADMIN),
        });
        setInquiryExpiryDays(String(data.inquiryExpiryDays));
        setWebAppUrl(data.webAppUrl);
        setEmailFrom(data.emailFrom);
        setTopupMin(String(data.walletTopupMinLkr));
        setTopupMax(data.walletTopupMaxLkr == null ? "" : String(data.walletTopupMaxLkr));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!token) return;

    const loginFees = Object.fromEntries(
      FEE_ROLES.map((role) => [role, Number(fees[role])])
    ) as Record<UserRole, number>;

    for (const role of FEE_ROLES) {
      if (!Number.isFinite(loginFees[role]) || loginFees[role] < 0) {
        setMsg(`Invalid login fee for ${role}.`);
        return;
      }
    }

    const days = Number(inquiryExpiryDays);
    const min = Number(topupMin);
    const max = topupMax.trim() === "" ? null : Number(topupMax);
    if (!Number.isFinite(days) || days < 1) {
      setMsg("Inquiry expiry must be at least 1 day.");
      return;
    }
    if (!Number.isFinite(min) || min < 0) {
      setMsg("Invalid top-up minimum.");
      return;
    }
    if (max != null && (!Number.isFinite(max) || max < min)) {
      setMsg("Top-up max must be empty or >= min.");
      return;
    }

    requestConfirm({
      title: "Save platform settings?",
      description: "Role login fees, expiry, and wallet limits apply immediately.",
      confirmLabel: "Save settings",
      summary: [
        { label: "Agency fee", value: `LKR ${loginFees.AGENCY}` },
        { label: "Influencer fee", value: `LKR ${loginFees.INFLUENCER}` },
        { label: "Driver fee", value: `LKR ${loginFees.DRIVER}` },
        { label: "Inquiry expiry", value: `${days} days` },
        { label: "Top-up min", value: `LKR ${min}` },
      ],
      onConfirm: async () => {
        setSaving(true);
        setMsg("");
        try {
          const saved = await api<PlatformSettings>("/admin/settings", {
            method: "PATCH",
            token,
            body: JSON.stringify({
              loginFees,
              inquiryExpiryDays: days,
              webAppUrl: webAppUrl.trim() || null,
              emailFrom: emailFrom.trim() || null,
              walletTopupMinLkr: min,
              walletTopupMaxLkr: max,
            }),
          });
          setSettings(saved);
          setMsg("Settings saved.");
        } catch {
          setMsg("Could not save settings.");
        } finally {
          setSaving(false);
        }
      },
    });
  }

  return (
    <div className="module-shell module-governance">
      <ModuleHeader
        module="governance"
        title="Platform settings"
        subtitle="Login fees by role, inquiry expiry, public URL, and wallet top-up limits. Per-user fee overrides are on Users."
      >
        <Link to="/dashboard/admin/cms" className="btn btn-ghost">
          Edit CMS pages
        </Link>
        <Link to="/dashboard/admin/users" className="btn btn-ghost">
          Per-user fees
        </Link>
      </ModuleHeader>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <form className="gov-panel" onSubmit={handleSave}>
          <h3>Login fees by role (LKR)</h3>
          <p className="muted">
            Charged on each OTP login. Set a custom amount on a user to override these defaults.
          </p>
          <div className="gov-settings-grid">
            {FEE_ROLES.map((role) => (
              <label key={role} htmlFor={`fee-${role}`}>
                {role}
                <input
                  id={`fee-${role}`}
                  type="number"
                  min={0}
                  step={1}
                  value={fees[role]}
                  onChange={(e) => setFees((prev) => ({ ...prev, [role]: e.target.value }))}
                />
              </label>
            ))}
          </div>

          <h3>Operations</h3>
          <label htmlFor="inquiry-expiry">
            Inquiry auto-expiry (days)
            <input
              id="inquiry-expiry"
              type="number"
              min={1}
              max={365}
              value={inquiryExpiryDays}
              onChange={(e) => setInquiryExpiryDays(e.target.value)}
            />
          </label>

          <label htmlFor="web-app-url">
            Public site URL
            <input
              id="web-app-url"
              type="url"
              placeholder="https://srilankatourpilot.com"
              value={webAppUrl}
              onChange={(e) => setWebAppUrl(e.target.value)}
            />
          </label>

          <label htmlFor="email-from">
            Email from
            <input
              id="email-from"
              type="text"
              placeholder="TourPilot &lt;noreply@srilankatourpilot.com&gt;"
              value={emailFrom}
              onChange={(e) => setEmailFrom(e.target.value)}
            />
          </label>

          <h3>Wallet top-up limits (LKR)</h3>
          <div className="gov-settings-grid">
            <label htmlFor="topup-min">
              Minimum
              <input
                id="topup-min"
                type="number"
                min={0}
                value={topupMin}
                onChange={(e) => setTopupMin(e.target.value)}
              />
            </label>
            <label htmlFor="topup-max">
              Maximum (empty = no max)
              <input
                id="topup-max"
                type="number"
                min={0}
                value={topupMax}
                onChange={(e) => setTopupMax(e.target.value)}
              />
            </label>
          </div>

          {settings?.updatedAt && (
            <p className="muted">Last updated {new Date(settings.updatedAt).toLocaleString()}</p>
          )}
          {msg && <p className="gov-status-msg">{msg}</p>}

          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Save settings"}
          </button>
        </form>
      )}
    </div>
  );
}
