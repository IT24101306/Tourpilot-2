import { FormEvent, useEffect, useState } from "react";
import {
  DEFAULT_SUPPORT_CONTENT,
  SESSION_INACTIVITY_DEFAULT_MINUTES,
  SESSION_INACTIVITY_MAX_MINUTES,
  SESSION_INACTIVITY_MIN_MINUTES,
  formatSessionInactivity,
  isRichTextEmpty,
  splitSessionInactivityForEdit,
  toSessionInactivityMinutes,
  type SessionInactivityUnit,
  type SupportAgent,
  type SupportContent,
  type UserRole,
} from "@tourpilot/shared";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useConfirmAction } from "../../components/confirm/ConfirmActionContext";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import { RichTextEditor } from "../../components/richtext/RichTextEditor";
import { applyPublicSmartFeatures } from "../../lib/publicSmartFeatures";

type EmailTemplate = { subject?: string; body?: string };

type PlatformSettings = {
  loginFees: Record<UserRole, number>;
  inquiryExpiryDays: number;
  webAppUrl: string;
  emailFrom: string;
  walletTopupMinLkr: number;
  walletTopupMaxLkr: number | null;
  sessionInactivityMinutes: number;
  sessionInactivityHours: number;
  emailTemplates: Record<string, EmailTemplate>;
  supportContent: SupportContent;
  agencyReferralEnabled: boolean;
  agencyReferralCap: number;
  agencyReferralLoginFeePct: number;
  agencyReferralRewardMonths: number;
  aiChatbotEnabled: boolean;
  aiTripPlannerEnabled: boolean;
  liveSupportEnabled: boolean;
  publicOffersEnabled: boolean;
  updatedAt: string | null;
};

const FEE_ROLES: UserRole[] = ["TOURIST", "AGENCY", "INFLUENCER", "DRIVER", "ADMIN"];

const TEMPLATE_META: { key: string; label: string; vars: string }[] = [
  {
    key: "otp",
    label: "Login / register OTP",
    vars: "{{recipientName}} {{otp}} {{purpose}}",
  },
  {
    key: "welcome",
    label: "Welcome after signup",
    vars: "{{name}} {{role}} {{appUrl}}",
  },
  {
    key: "tripMessage",
    label: "New trip-room message",
    vars: "{{recipientName}} {{preview}} {{tripUrl}}",
  },
  {
    key: "agencyApproved",
    label: "Agency approved",
    vars: "{{agencyName}} {{ownerName}} {{dashboardUrl}}",
  },
  {
    key: "agencyRejection",
    label: "Agency rejection",
    vars: "{{agencyName}} {{ownerName}} {{reason}}",
  },
  {
    key: "walletReceipt",
    label: "Wallet / login-fee receipt",
    vars: "{{recipientName}} {{kind}} {{amountLkr}} {{balanceLkr}}",
  },
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
];

function blankAgent(): SupportAgent {
  return {
    id: `agent-${Date.now().toString(36)}`,
    name: "",
    role: "",
    service: "",
    description: "",
    priceUsd: 0,
    priceLabel: "",
    phone: "",
    phoneDisplay: "",
  };
}

function FeatureSwitchRow({
  label,
  hint,
  on,
  onToggle,
}: {
  label: string;
  hint: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="gov-features-row">
      <div className="gov-features-row__copy">
        <span className="gov-features-row__label">{label}</span>
        <span className="gov-features-row__hint">{hint}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={`${label}: ${on ? "enabled" : "disabled"}`}
        className={`gov-feature-switch${on ? " is-on" : ""}`}
        onClick={onToggle}
      >
        <span className="gov-feature-switch__track">
          <span className="gov-feature-switch__thumb" />
        </span>
        <span className="gov-feature-switch__state">{on ? "On" : "Off"}</span>
      </button>
    </div>
  );
}

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
  const [inquiryExpiryDays, setInquiryExpiryDays] = useState("7");
  const [webAppUrl, setWebAppUrl] = useState("");
  const [emailFrom, setEmailFrom] = useState("");
  const [topupMin, setTopupMin] = useState("100");
  const [topupMax, setTopupMax] = useState("");
  const [idleAmount, setIdleAmount] = useState("180");
  const [idleUnit, setIdleUnit] = useState<SessionInactivityUnit>("minutes");
  const [templates, setTemplates] = useState<Record<string, EmailTemplate>>({});
  const [support, setSupport] = useState<SupportContent>(
    structuredClone(DEFAULT_SUPPORT_CONTENT)
  );
  const [referralEnabled, setReferralEnabled] = useState(true);
  const [referralCap, setReferralCap] = useState("5");
  const [referralPct, setReferralPct] = useState("25");
  const [referralMonths, setReferralMonths] = useState("12");
  const [aiChatbotEnabled, setAiChatbotEnabled] = useState(true);
  const [aiTripPlannerEnabled, setAiTripPlannerEnabled] = useState(true);
  const [liveSupportEnabled, setLiveSupportEnabled] = useState(true);
  const [publicOffersEnabled, setPublicOffersEnabled] = useState(true);
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
        const idle = splitSessionInactivityForEdit(
          data.sessionInactivityMinutes ??
            (data.sessionInactivityHours
              ? data.sessionInactivityHours * 60
              : SESSION_INACTIVITY_DEFAULT_MINUTES)
        );
        setIdleAmount(String(idle.amount));
        setIdleUnit(idle.unit);
        setTemplates(data.emailTemplates || {});
        setSupport(data.supportContent || structuredClone(DEFAULT_SUPPORT_CONTENT));
        setReferralEnabled(data.agencyReferralEnabled ?? true);
        setReferralCap(String(data.agencyReferralCap ?? 5));
        setReferralPct(String(data.agencyReferralLoginFeePct ?? 25));
        setReferralMonths(String(data.agencyReferralRewardMonths ?? 12));
        setAiChatbotEnabled(data.aiChatbotEnabled ?? true);
        setAiTripPlannerEnabled(data.aiTripPlannerEnabled ?? true);
        setLiveSupportEnabled(data.liveSupportEnabled ?? true);
        setPublicOffersEnabled(data.publicOffersEnabled ?? true);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  function updateAgent(index: number, patch: Partial<SupportAgent>) {
    setSupport((prev) => ({
      ...prev,
      agents: prev.agents.map((a, i) => (i === index ? { ...a, ...patch } : a)),
    }));
  }

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

    const idleMax = idleUnit === "hours" ? 168 : SESSION_INACTIVITY_MAX_MINUTES;
    const idleRaw = Number(idleAmount);
    if (
      !Number.isFinite(idleRaw) ||
      idleRaw < SESSION_INACTIVITY_MIN_MINUTES ||
      idleRaw > idleMax
    ) {
      setMsg(
        idleUnit === "hours"
          ? "Session inactivity must be between 1 and 168 hours."
          : `Session inactivity must be between ${SESSION_INACTIVITY_MIN_MINUTES} and ${SESSION_INACTIVITY_MAX_MINUTES} minutes.`
      );
      return;
    }
    const sessionInactivityMinutes = toSessionInactivityMinutes(idleRaw, idleUnit);

    const emailTemplates: Record<string, EmailTemplate> = {};
    for (const meta of TEMPLATE_META) {
      const t = templates[meta.key];
      if (!t) continue;
      const subject = t.subject?.trim();
      const body = t.body?.trim();
      if (subject || body) emailTemplates[meta.key] = { subject, body };
    }

    const supportContent: SupportContent = {
      title: support.title.trim() || DEFAULT_SUPPORT_CONTENT.title,
      subtitle: support.subtitle.trim() || DEFAULT_SUPPORT_CONTENT.subtitle,
      footer: support.footer.trim() || DEFAULT_SUPPORT_CONTENT.footer,
      agents: support.agents.map((a, i) => ({
        ...a,
        id: a.id.trim() || `agent-${i + 1}`,
        name: a.name.trim(),
        role: a.role.trim(),
        service: a.service.trim(),
        description: isRichTextEmpty(a.description) ? "" : a.description,
        priceUsd: Number.isFinite(Number(a.priceUsd)) ? Number(a.priceUsd) : 0,
        priceLabel: a.priceLabel.trim(),
        phone: a.phone.trim(),
        phoneDisplay: a.phoneDisplay.trim() || a.phone.trim(),
      })),
    };

    if (!supportContent.agents.length) {
      setMsg("Add at least one support agent.");
      return;
    }

    const cap = Number(referralCap);
    const pct = Number(referralPct);
    const months = Number(referralMonths);
    if (!Number.isFinite(cap) || cap < 1 || cap > 50) {
      setMsg("Referral cap must be between 1 and 50.");
      return;
    }
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      setMsg("Referral login fee % must be between 0 and 100.");
      return;
    }
    if (!Number.isFinite(months) || months < 1 || months > 60) {
      setMsg("Referral reward months must be between 1 and 60.");
      return;
    }

    requestConfirm({
      title: "Save platform settings?",
      description:
        "Login fees, wallet limits, enquiry expiry, session timeout, email overrides, support modal copy, and AI feature switches apply immediately.",
      confirmLabel: "Save settings",
      summary: [
        { label: "Inquiry expiry", value: `${Math.round(expiry)} days` },
        { label: "Top-up min", value: `${Math.round(min).toLocaleString()} Credits` },
        {
          label: "Top-up max",
          value: max == null ? "No max" : `${Math.round(max).toLocaleString()} Credits`,
        },
        {
          label: "Session inactivity default",
          value: formatSessionInactivity(sessionInactivityMinutes),
        },
        { label: "Support agents", value: String(supportContent.agents.length) },
        {
          label: "Agency referrals",
          value: referralEnabled
            ? `${Math.round(cap)} max · ${Math.round(pct)}% · ${Math.round(months)} mo`
            : "Off",
        },
        { label: "Ask AI", value: aiChatbotEnabled ? "On" : "Off" },
        { label: "Talk to a human", value: liveSupportEnabled ? "On" : "Off" },
        { label: "AI Trip Planner", value: aiTripPlannerEnabled ? "On" : "Off" },
        { label: "Public offers", value: publicOffersEnabled ? "On" : "Off" },
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
              sessionInactivityMinutes,
              emailTemplates,
              supportContent,
              agencyReferralEnabled: referralEnabled,
              agencyReferralCap: Math.round(cap),
              agencyReferralLoginFeePct: Math.round(pct),
              agencyReferralRewardMonths: Math.round(months),
              aiChatbotEnabled,
              aiTripPlannerEnabled,
              liveSupportEnabled,
              publicOffersEnabled,
            }),
          });
          setSettings(data);
          setSupport(data.supportContent);
          setReferralEnabled(data.agencyReferralEnabled);
          setReferralCap(String(data.agencyReferralCap));
          setReferralPct(String(data.agencyReferralLoginFeePct));
          setReferralMonths(String(data.agencyReferralRewardMonths));
          setAiChatbotEnabled(data.aiChatbotEnabled);
          setAiTripPlannerEnabled(data.aiTripPlannerEnabled);
          setLiveSupportEnabled(data.liveSupportEnabled);
          setPublicOffersEnabled(data.publicOffersEnabled);
          applyPublicSmartFeatures({
            aiChatbotEnabled: data.aiChatbotEnabled,
            aiTripPlannerEnabled: data.aiTripPlannerEnabled,
            liveSupportEnabled: data.liveSupportEnabled,
            publicOffersEnabled: data.publicOffersEnabled,
          });
          const idle = splitSessionInactivityForEdit(data.sessionInactivityMinutes);
          setIdleAmount(String(idle.amount));
          setIdleUnit(idle.unit);
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
        subtitle="Fees, wallet limits, enquiry expiry, site features, support modal, site email, and message templates."
      />

      {msg && <p className="gov-status-msg">{msg}</p>}

      {loading || !settings ? (
        <p className="muted">Loading…</p>
      ) : (
        <form className="gov-settings-stack" onSubmit={onSubmit}>
          <details className="gov-settings-section" open>
            <summary className="gov-settings-section__summary">
              <span>Login fees</span>
              <span className="gov-settings-section__hint">Credits per OTP login by role</span>
            </summary>
            <div className="gov-settings-section__body">
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
            </div>
          </details>

          <details className="gov-settings-section" open>
            <summary className="gov-settings-section__summary">
              <span>Site features</span>
              <span className="gov-settings-section__hint">Ask AI, live support, planner, public offers</span>
            </summary>
            <div className="gov-settings-section__body">
              <p className="muted">
                Turn these off site-wide when you need to pause AI spend, live chat, or the public
                offers catalog. This tab updates as soon as you save; other visitors pick it up on
                their next page load.
              </p>
              <div className="gov-features-table" role="group" aria-label="Site feature toggles">
                <FeatureSwitchRow
                  label="Ask AI"
                  hint="Floating ASK button on public pages. Off hides AI replies; Talk to a human can stay on."
                  on={aiChatbotEnabled}
                  onToggle={() => setAiChatbotEnabled((v) => !v)}
                />
                <FeatureSwitchRow
                  label="Talk to a human"
                  hint="Live support from the public widget. Independent of Ask AI — keep this on if you still want human chat."
                  on={liveSupportEnabled}
                  onToggle={() => setLiveSupportEnabled((v) => !v)}
                />
                <FeatureSwitchRow
                  label="AI Trip Planner"
                  hint="Plan trip in the public nav and /plan. Off hides the link and blocks new AI itineraries."
                  on={aiTripPlannerEnabled}
                  onToggle={() => setAiTripPlannerEnabled((v) => !v)}
                />
                <FeatureSwitchRow
                  label="Public offers"
                  hint="Offers in the public nav, /offers catalog, and traveler booking. Agency and admin offer tools stay available."
                  on={publicOffersEnabled}
                  onToggle={() => setPublicOffersEnabled((v) => !v)}
                />
              </div>
            </div>
          </details>

          <details className="gov-settings-section">
            <summary className="gov-settings-section__summary">
              <span>Agency referrals</span>
              <span className="gov-settings-section__hint">Invite cap, login-fee share, reward window</span>
            </summary>
            <div className="gov-settings-section__body">
              <p className="muted">
                Approved agencies can invite other agencies by phone. Referrers earn a share of each
                charged login fee for a fixed window after the invitee is approved.
              </p>
              <label className="gov-check-row">
                <input
                  type="checkbox"
                  checked={referralEnabled}
                  onChange={(e) => setReferralEnabled(e.target.checked)}
                />
                <span>Enable agency-to-agency referrals</span>
              </label>
              <div className="gov-fee-grid">
                <label className="gov-fee-field">
                  <span>Max successful referrals</span>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={referralCap}
                    onChange={(e) => setReferralCap(e.target.value)}
                  />
                </label>
                <label className="gov-fee-field">
                  <span>Referrer % of login fee</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={referralPct}
                    onChange={(e) => setReferralPct(e.target.value)}
                  />
                </label>
                <label className="gov-fee-field">
                  <span>Reward window (months)</span>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={referralMonths}
                    onChange={(e) => setReferralMonths(e.target.value)}
                  />
                </label>
              </div>
            </div>
          </details>

          <details className="gov-settings-section">
            <summary className="gov-settings-section__summary">
              <span>Operations</span>
              <span className="gov-settings-section__hint">Site URL, wallet, sessions, expiry</span>
            </summary>
            <div className="gov-settings-section__body gov-settings-section__body--nested">
              <details className="gov-settings-subsection" open>
                <summary>Site & inquiries</summary>
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
                  <p className="muted" style={{ margin: 0 }}>
                    Default is 7 days (1 week). Agencies can reopen inquiries that closed due to
                    inactivity; declined inquiries stay closed.
                  </p>
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
                </div>
              </details>

              <details className="gov-settings-subsection">
                <summary>Wallet top-up limits</summary>
                <div className="gov-settings-fields">
                  <label>
                    Top-up min (Credits)
                    <input
                      type="number"
                      min={1}
                      value={topupMin}
                      onChange={(e) => setTopupMin(e.target.value)}
                    />
                  </label>
                  <label>
                    Top-up max (Credits, blank = no max)
                    <input
                      type="number"
                      min={1}
                      value={topupMax}
                      onChange={(e) => setTopupMax(e.target.value)}
                      placeholder="Optional"
                    />
                  </label>
                </div>
              </details>

              <details className="gov-settings-subsection">
                <summary>Session inactivity</summary>
                <div className="gov-settings-fields">
                  <label>
                    Default timeout
                    <div className="gov-settings-inline">
                      <input
                        type="number"
                        min={SESSION_INACTIVITY_MIN_MINUTES}
                        max={idleUnit === "hours" ? 168 : SESSION_INACTIVITY_MAX_MINUTES}
                        value={idleAmount}
                        onChange={(e) => setIdleAmount(e.target.value)}
                      />
                      <select
                        className="agency-filter"
                        value={idleUnit}
                        onChange={(e) => setIdleUnit(e.target.value as SessionInactivityUnit)}
                      >
                        <option value="minutes">Minutes</option>
                        <option value="hours">Hours</option>
                      </select>
                    </div>
                  </label>
                </div>
                <p className="muted" style={{ marginTop: 8 }}>
                  Used when an agency has the session inactivity package enabled and no per-agency
                  override. Re-login after timeout charges the login fee again.
                  {Number.isFinite(Number(idleAmount))
                    ? ` Currently ${formatSessionInactivity(
                        toSessionInactivityMinutes(Number(idleAmount), idleUnit)
                      )}.`
                    : ""}
                </p>
              </details>
            </div>
          </details>

          <details className="gov-settings-section">
            <summary className="gov-settings-section__summary">
              <span>Support modal</span>
              <span className="gov-settings-section__hint">
                {support.agents.length} agent{support.agents.length === 1 ? "" : "s"}
              </span>
            </summary>
            <div className="gov-settings-section__body gov-settings-section__body--nested">
              <details className="gov-settings-subsection" open>
                <summary>Modal copy</summary>
                <div className="gov-settings-fields">
                  <label>
                    Title
                    <input
                      value={support.title}
                      onChange={(e) => setSupport((p) => ({ ...p, title: e.target.value }))}
                    />
                  </label>
                  <label>
                    Subtitle
                    <textarea
                      rows={2}
                      value={support.subtitle}
                      onChange={(e) => setSupport((p) => ({ ...p, subtitle: e.target.value }))}
                    />
                  </label>
                  <label>
                    Footer note
                    <textarea
                      rows={2}
                      value={support.footer}
                      onChange={(e) => setSupport((p) => ({ ...p, footer: e.target.value }))}
                    />
                  </label>
                </div>
              </details>

              {support.agents.map((agent, index) => (
                <details key={agent.id} className="gov-settings-subsection">
                  <summary>
                    Agent {index + 1}
                    {agent.name.trim() ? ` — ${agent.name.trim()}` : ""}
                  </summary>
                  <div className="gov-settings-subsection__toolbar">
                    <button
                      type="button"
                      className="btn btn-ghost btn-nav"
                      disabled={support.agents.length <= 1}
                      onClick={() =>
                        setSupport((p) => ({
                          ...p,
                          agents: p.agents.filter((_, i) => i !== index),
                        }))
                      }
                    >
                      Remove agent
                    </button>
                  </div>
                  <div className="gov-settings-fields">
                    <label>
                      Name
                      <input
                        value={agent.name}
                        onChange={(e) => updateAgent(index, { name: e.target.value })}
                      />
                    </label>
                    <label>
                      Role
                      <input
                        value={agent.role}
                        onChange={(e) => updateAgent(index, { role: e.target.value })}
                      />
                    </label>
                    <label>
                      Service
                      <input
                        value={agent.service}
                        onChange={(e) => updateAgent(index, { service: e.target.value })}
                      />
                    </label>
                    <label>
                      Description
                      <RichTextEditor
                        rows={3}
                        value={agent.description}
                        onChange={(description) => updateAgent(index, { description })}
                        aria-label={`Agent ${index + 1} description`}
                      />
                    </label>
                    <label>
                      Price label (shown)
                      <input
                        value={agent.priceLabel}
                        onChange={(e) => updateAgent(index, { priceLabel: e.target.value })}
                        placeholder="$29 USD"
                      />
                    </label>
                    <label>
                      Price USD (number)
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={agent.priceUsd}
                        onChange={(e) =>
                          updateAgent(index, { priceUsd: Number(e.target.value) || 0 })
                        }
                      />
                    </label>
                    <label>
                      Phone (tel: link)
                      <input
                        value={agent.phone}
                        onChange={(e) => updateAgent(index, { phone: e.target.value })}
                        placeholder="+94771234567"
                      />
                    </label>
                    <label>
                      Phone display
                      <input
                        value={agent.phoneDisplay}
                        onChange={(e) => updateAgent(index, { phoneDisplay: e.target.value })}
                        placeholder="+94 77 123 4567"
                      />
                    </label>
                  </div>
                </details>
              ))}

              <div className="gov-settings-section__actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() =>
                    setSupport((p) => ({ ...p, agents: [...p.agents, blankAgent()] }))
                  }
                >
                  Add agent
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setSupport(structuredClone(DEFAULT_SUPPORT_CONTENT))}
                >
                  Reset support copy
                </button>
              </div>
            </div>
          </details>

          <details className="gov-settings-section">
            <summary className="gov-settings-section__summary">
              <span>Email templates</span>
              <span className="gov-settings-section__hint">Optional overrides</span>
            </summary>
            <div className="gov-settings-section__body">
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
                      <RichTextEditor
                        rows={5}
                        value={templates[meta.key]?.body || ""}
                        onChange={(body) =>
                          setTemplates((prev) => ({
                            ...prev,
                            [meta.key]: { ...prev[meta.key], body },
                          }))
                        }
                        aria-label={`${meta.label} body`}
                      />
                    </label>
                  </details>
                ))}
              </div>
            </div>
          </details>

          <div className="gov-settings-sticky-save">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Save platform settings"}
            </button>
            {settings.updatedAt && (
              <p className="muted">Last saved {new Date(settings.updatedAt).toLocaleString()}.</p>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
