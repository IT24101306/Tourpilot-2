import { FormEvent, useEffect, useState } from "react";
import type { UserRole } from "@tourpilot/shared";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useConfirmAction } from "../../components/confirm/ConfirmActionContext";
import { ModuleHeader } from "../../components/module/ModuleHeader";

type EmailTemplate = { subject?: string; body?: string };

type PlatformSettings = {
  loginFees: Record<UserRole, number>;
  inquiryExpiryDays: number;
  webAppUrl: string;
  emailFrom: string;
  walletTopupMinLkr: number;
  walletTopupMaxLkr: number | null;
  emailTemplates: Record<string, EmailTemplate>;
  updatedAt: string | null;
};

const FEE_ROLES: UserRole[] = ["TOURIST", "AGENCY", "INFLUENCER", "DRIVER", "ADMIN"];

const TEMPLATE_META: { key: string; label: string; vars: string }[] = [
  {
    key: "inquiryCreated",
    label: "Inquiry created (to agency)",
    vars: "{{agencyName}} {{touristName}} {{tripUrl}}",
  },
  {
    key: "proposalSent",
    label: "Proposal sent (to tourist)",
    vars: "{{agencyName}} {{touristName}} {{tripUrl}}",
  },
  {
    key: "inquiryStatus",
    label: "Inquiry status change",
    vars: "{{agencyName}} {{touristName}} {{status}} {{tripUrl}} {{note}}",
  },
  {
    key: "inquiryExpired",
    label: "Inquiry expired",
    vars: "{{agencyName}} {{recipientName}} {{tripUrl}}",
  },
  {
    key: "commissionPaid",
    label: "Commission paid",
    vars: "{{influencerName}} {{amountLkr}} {{walletBalance}}",
  },
  {
    key: "agencyRejection",
    label: "Agency rejection",
    vars: "{{agencyName}} {{ownerName}} {{reason}}",
  },
];

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
  const [templates, setTemplates] = useState<Record<string, EmailTemplate>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!token) return;
    setLoading(true);
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
        setWebAppUrl(data.webAppUrl || "");
        setEmailFrom(data.emailFrom || "");
        setTopupMin(String(data.walletTopupMinLkr));
        setTopupMax(data.walletTopupMaxLkr != null ? String(data.walletTopupMaxLkr) : "");
        setTemplates(data.emailTemplates || {});
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;

    const loginFees = {} as Record<UserRole, number>;
    for (const role of FEE_ROLES) {
      const n = Number(fees[role]);
      if (!Number.isFinite(n) || n < 0) {
        setMsg(`Invalid fee for ${role}.`);
        return;
      }
      loginFees[role] = Math.round(n);
    }

    const expiry = Number(inquiryExpiryDays);
    const min = Number(topupMin);
    const maxRaw = topupMax.trim();
    const max = maxRaw === "" ? null : Number(maxRaw);
    if (!Number.isFinite(expiry) || expiry < 1) {
      setMsg("Inquiry expiry must be at least 1 day.");
      return;
    }
    if (!Number.isFinite(min) || min < 1) {
      setMsg("Wallet top-up min must be at least 1.");
      return;
    }
    if (max != null && (!Number.isFinite(max) || max < min)) {
      setMsg("Wallet top-up max must be empty or ≥ min.");
      return;
    }

    const emailTemplates: Record<string, EmailTemplate> = {};
    for (const meta of TEMPLATE_META) {
      const t = templates[meta.key];
      if (!t) continue;
      const subject = t.subject?.trim();
      const body = t.body?.trim();
      if (subject || body) emailTemplates[meta.key] = { subject, body };
    }

    requestConfirm({
      title: "Save platform settings?",
      description: "Login fees, wallet limits, enquiry expiry, and email overrides apply immediately.",
      confirmLabel: "Save settings",
      summary: [
        { label: "Inquiry expiry", value: `${Math.round(expiry)} days` },
        { label: "Top-up min", value: `LKR ${Math.round(min).toLocaleString()}` },
        {
          label: "Top-up max",
          value: max == null ? "No max" : `LKR ${Math.round(max).toLocaleString()}`,
        },
      ],
      onConfirm: async () => {
        setSaving(true);
        try {
          const data = await api<PlatformSettings>("/admin/settings", {
            method: "PUT",
            token,
            body: JSON.stringify({
              loginFees,
              inquiryExpiryDays: Math.round(expiry),
              webAppUrl: webAppUrl.trim() || null,
              emailFrom: emailFrom.trim() || null,
              walletTopupMinLkr: Math.round(min),
              walletTopupMaxLkr: max == null ? null : Math.round(max),
              emailTemplates,
            }),
          });
          setSettings(data);
          setMsg("Platform settings saved.");
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
        subtitle="Fees, wallet limits, enquiry expiry, site email, and message templates."
      />

      {msg && <p className="gov-status-msg">{msg}</p>}

      {loading || !settings ? (
        <p className="muted">Loading…</p>
      ) : (
        <form className="gov-settings-stack" onSubmit={onSubmit}>
          <section className="gov-form-card">
            <h3 className="gov-form-card__title">Login fees (LKR)</h3>
            <p className="muted">
              Charged on OTP login. Per-user overrides live on Users. Set 0 to disable a role.
            </p>
            <div className="gov-fee-grid">
              {FEE_ROLES.map((role) => (
                <label key={role} className="gov-fee-field">
                  <span>{role}</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={fees[role]}
                    onChange={(e) => setFees((prev) => ({ ...prev, [role]: e.target.value }))}
                  />
                </label>
              ))}
            </div>
          </section>

          <section className="gov-form-card">
            <h3 className="gov-form-card__title">Operations</h3>
            <div className="gov-settings-fields">
              <label>
                Inquiry auto-expiry (days)
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={inquiryExpiryDays}
                  onChange={(e) => setInquiryExpiryDays(e.target.value)}
                />
              </label>
              <label>
                Public site URL
                <input
                  type="url"
                  placeholder="https://srilankatourpilot.com"
                  value={webAppUrl}
                  onChange={(e) => setWebAppUrl(e.target.value)}
                />
              </label>
              <label>
                Email from
                <input
                  type="text"
                  placeholder='TourPilot &lt;noreply@example.com&gt;'
                  value={emailFrom}
                  onChange={(e) => setEmailFrom(e.target.value)}
                />
              </label>
              <label>
                Wallet top-up min (LKR)
                <input
                  type="number"
                  min={1}
                  value={topupMin}
                  onChange={(e) => setTopupMin(e.target.value)}
                />
              </label>
              <label>
                Wallet top-up max (LKR, blank = no max)
                <input
                  type="number"
                  min={1}
                  value={topupMax}
                  onChange={(e) => setTopupMax(e.target.value)}
                  placeholder="Optional"
                />
              </label>
            </div>
          </section>

          <section className="gov-form-card">
            <h3 className="gov-form-card__title">Email templates (optional)</h3>
            <p className="muted">
              Leave blank to keep built-in copy. Use placeholders like {"{{tripUrl}}"}.
            </p>
            <div className="gov-template-list">
              {TEMPLATE_META.map((meta) => (
                <details key={meta.key} className="gov-template-item">
                  <summary>{meta.label}</summary>
                  <p className="muted gov-template-vars">{meta.vars}</p>
                  <label>
                    Subject
                    <input
                      value={templates[meta.key]?.subject || ""}
                      onChange={(e) =>
                        setTemplates((prev) => ({
                          ...prev,
                          [meta.key]: { ...prev[meta.key], subject: e.target.value },
                        }))
                      }
                    />
                  </label>
                  <label>
                    Body
                    <textarea
                      rows={5}
                      value={templates[meta.key]?.body || ""}
                      onChange={(e) =>
                        setTemplates((prev) => ({
                          ...prev,
                          [meta.key]: { ...prev[meta.key], body: e.target.value },
                        }))
                      }
                    />
                  </label>
                </details>
              ))}
            </div>
          </section>

          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Save platform settings"}
          </button>
          {settings.updatedAt && (
            <p className="muted">Last saved {new Date(settings.updatedAt).toLocaleString()}.</p>
          )}
        </form>
      )}
    </div>
  );
}
