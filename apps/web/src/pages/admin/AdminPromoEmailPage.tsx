import { useEffect, useMemo, useState } from "react";
import type { UserRole } from "@tourpilot/shared";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useConfirmAction } from "../../components/confirm/ConfirmActionContext";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import { ImageUrlField } from "../../components/ImageUrlField";

type OfferOption = {
  id: string;
  title: string;
  imageUrl?: string | null;
  isActive: boolean;
};

type EmailStatus = {
  mode: string;
  from: string;
  smtp: {
    host: string | null;
    port: number;
    user: string | null;
    secure: boolean;
    passConfigured: boolean;
  };
  ready: boolean;
  hint?: string;
  ok?: boolean;
  error?: string;
};

const AUDIENCE_ROLES: { role: Exclude<UserRole, "ADMIN">; label: string }[] = [
  { role: "TOURIST", label: "Tourists" },
  { role: "AGENCY", label: "Agencies" },
  { role: "INFLUENCER", label: "Influencers" },
  { role: "DRIVER", label: "Drivers" },
];

export function AdminPromoEmailPage() {
  const { token } = useAuth();
  const { requestConfirm } = useConfirmAction();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [posterUrl, setPosterUrl] = useState("");
  const [offerId, setOfferId] = useState("");
  const [offers, setOffers] = useState<OfferOption[]>([]);
  const [roles, setRoles] = useState<Exclude<UserRole, "ADMIN">[]>([
    "TOURIST",
    "AGENCY",
    "INFLUENCER",
  ]);
  const [testTo, setTestTo] = useState("");
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [statusTone, setStatusTone] = useState<"muted" | "error" | "ok">("muted");
  const [sending, setSending] = useState(false);
  const [testing, setTesting] = useState(false);
  const [emailStatus, setEmailStatus] = useState<EmailStatus | null>(null);
  const [verifying, setVerifying] = useState(false);

  function showStatus(message: string, tone: "muted" | "error" | "ok" = "muted") {
    setStatus(message);
    setStatusTone(tone);
  }

  const rolesKey = useMemo(() => roles.slice().sort().join(","), [roles]);

  async function refreshEmailStatus() {
    if (!token) return;
    try {
      const data = await api<EmailStatus>("/admin/email-status", { token });
      setEmailStatus(data);
    } catch {
      setEmailStatus(null);
    }
  }

  useEffect(() => {
    if (!token) return;
    api<OfferOption[]>("/offers", { token })
      .then((list) => setOffers(list.filter((o) => o.isActive)))
      .catch(console.error);
    void refreshEmailStatus();
  }, [token]);

  useEffect(() => {
    if (!token || !roles.length) {
      setAudienceCount(0);
      return;
    }
    api<{ count: number }>(`/admin/promo-email/audience?roles=${encodeURIComponent(rolesKey)}`, {
      token,
    })
      .then((data) => setAudienceCount(data.count))
      .catch(() => setAudienceCount(null));
  }, [token, rolesKey, roles.length]);

  async function verifySmtp() {
    if (!token) return;
    setVerifying(true);
    try {
      const data = await api<EmailStatus>("/admin/email-status/verify", {
        method: "POST",
        token,
      });
      setEmailStatus(data);
      showStatus(
        data.ok
          ? "SMTP connection OK — try Send test next."
          : `SMTP check failed: ${data.error || data.hint || "unknown"}`,
        data.ok ? "ok" : "error"
      );
    } catch (err) {
      showStatus(err instanceof Error ? err.message : "SMTP verify failed", "error");
    } finally {
      setVerifying(false);
    }
  }

  function toggleRole(role: Exclude<UserRole, "ADMIN">) {
    setRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  }

  async function sendTest() {
    if (!token) {
      showStatus("Sign in again, then retry.", "error");
      return;
    }
    const to = testTo.trim();
    if (!subject.trim() || subject.trim().length < 3) {
      showStatus("Subject must be at least 3 characters.", "error");
      return;
    }
    if (!body.trim() || body.trim().length < 3) {
      showStatus("Message must be at least 3 characters.", "error");
      return;
    }
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      showStatus("Enter a valid test email address.", "error");
      return;
    }
    if (emailStatus && emailStatus.mode === "smtp" && !emailStatus.smtp.passConfigured) {
      showStatus(
        "SMTP password is missing on the API server. Set SMTP_PASS in apps/api/.env and restart the API.",
        "error"
      );
      return;
    }

    setTesting(true);
    showStatus("Sending test email…", "muted");
    try {
      const result = await api<{
        sent: number;
        failed: number;
        deliveryMode?: string;
        errors?: string[];
      }>("/admin/promo-email", {
        method: "POST",
        token,
        body: JSON.stringify({
          subject: subject.trim(),
          body: body.trim(),
          posterUrl: posterUrl.trim() || null,
          offerId: offerId || null,
          roles: roles.length ? roles : ["TOURIST"],
          testTo: to,
        }),
      });
      if (result.sent && result.deliveryMode === "smtp") {
        showStatus(`Test email sent to ${to} via SMTP.`, "ok");
      } else if (result.sent && result.deliveryMode === "log") {
        showStatus(
          result.errors?.[0] ||
            "Logged to API console only (EMAIL_MODE=log). Configure SMTP to send real mail.",
          "error"
        );
      } else {
        showStatus(`Test failed: ${result.errors?.[0] || "unknown error"}`, "error");
      }
    } catch (err) {
      showStatus(err instanceof Error ? err.message : "Test send failed", "error");
    } finally {
      setTesting(false);
    }
  }

  async function sendBroadcast() {
    if (!token || !roles.length) return;
    requestConfirm({
      title: "Send promotional email?",
      description: "Emails go to active users who have an address on file for the selected roles.",
      confirmLabel: "Send to all",
      summary: [
        { label: "Subject", value: subject.trim() },
        {
          label: "Audience",
          value: `${audienceCount ?? "?"} recipients (${roles.join(", ")})`,
        },
        {
          label: "Offer",
          value: offerId
            ? offers.find((o) => o.id === offerId)?.title || offerId
            : "None",
        },
        { label: "Poster", value: posterUrl.trim() ? "Yes" : "No" },
      ],
      onConfirm: async () => {
        setSending(true);
        showStatus("Sending promotional email…", "muted");
        try {
          const result = await api<{
            audience: number;
            sent: number;
            failed: number;
            deliveryMode?: string;
            errors?: string[];
          }>("/admin/promo-email", {
            method: "POST",
            token,
            body: JSON.stringify({
              subject,
              body,
              posterUrl: posterUrl.trim() || null,
              offerId: offerId || null,
              roles,
            }),
          });
          const summary =
            `Sent ${result.sent} of ${result.audience}` +
            (result.deliveryMode ? ` via ${result.deliveryMode}` : "") +
            (result.failed ? ` (${result.failed} failed)` : "") +
            (result.errors?.length ? `. ${result.errors[0]}` : "");
          showStatus(summary, result.failed || result.deliveryMode === "log" ? "error" : "ok");
        } catch (err) {
          showStatus(err instanceof Error ? err.message : "Broadcast failed", "error");
        } finally {
          setSending(false);
        }
      },
    });
  }

  return (
    <div className="module-shell module-governance">
      <ModuleHeader
        module="governance"
        title="Promotional email"
        subtitle="Send offers and posters to users who registered with an email."
      />

      {emailStatus && (
        <div
          className="gov-panel"
          style={{
            maxWidth: 720,
            marginBottom: 16,
            borderColor: emailStatus.ready && emailStatus.mode === "smtp" ? undefined : "#b45309",
          }}
        >
          <p style={{ margin: 0 }}>
            <strong>Email mode:</strong> {emailStatus.mode}
            {emailStatus.mode === "smtp" ? (
              <>
                {" "}
                · host {emailStatus.smtp.host || "(missing)"}:{emailStatus.smtp.port}
                {" "}
                · user {emailStatus.smtp.user || "(missing)"}
                {" "}
                · password {emailStatus.smtp.passConfigured ? "set" : "MISSING"}
              </>
            ) : null}
          </p>
          {emailStatus.hint ? (
            <p className="muted" style={{ margin: "8px 0 0" }}>
              {emailStatus.hint}
            </p>
          ) : null}
          {emailStatus.error ? (
            <p className="form-error" style={{ margin: "8px 0 0" }}>
              {emailStatus.error}
            </p>
          ) : null}
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={verifying}
              onClick={() => void verifySmtp()}
            >
              {verifying ? "Checking…" : "Test SMTP connection"}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void refreshEmailStatus()}
            >
              Refresh status
            </button>
          </div>
        </div>
      )}

      <div className="form-grid" style={{ maxWidth: 720 }}>
        <label htmlFor="promo-subject">Subject</label>
        <input
          id="promo-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          minLength={3}
          placeholder="Summer specials on TourPilot"
        />

        <label htmlFor="promo-body">Message</label>
        <textarea
          id="promo-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          minLength={3}
          rows={6}
          placeholder="Tell travelers what’s new…"
        />

        <ImageUrlField
          label="Poster image (optional)"
          value={posterUrl}
          onChange={setPosterUrl}
          token={token}
          hint="Upload a poster or paste an image URL. Shown in the email."
        />

        <label htmlFor="promo-offer">Attach site offer (optional)</label>
        <select
          id="promo-offer"
          value={offerId}
          onChange={(e) => {
            setOfferId(e.target.value);
            const selected = offers.find((o) => o.id === e.target.value);
            if (selected?.imageUrl && !posterUrl.trim()) {
              setPosterUrl(selected.imageUrl);
            }
          }}
        >
          <option value="">No offer link</option>
          {offers.map((o) => (
            <option key={o.id} value={o.id}>
              {o.title}
            </option>
          ))}
        </select>

        <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
          <legend style={{ fontWeight: 600, marginBottom: 8 }}>Audience</legend>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {AUDIENCE_ROLES.map(({ role, label }) => (
              <label key={role} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={roles.includes(role)}
                  onChange={() => toggleRole(role)}
                />
                {label}
              </label>
            ))}
          </div>
          <p className="muted" style={{ margin: "8px 0 0", fontSize: "0.9rem" }}>
            {audienceCount == null
              ? "Counting recipients…"
              : `${audienceCount} active user${audienceCount === 1 ? "" : "s"} with email`}
          </p>
        </fieldset>

        <label htmlFor="promo-test">Send a test to</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            id="promo-test"
            type="email"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="you@example.com"
            style={{ flex: 1, minWidth: 200 }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void sendTest();
              }
            }}
          />
          <button
            type="button"
            className="btn btn-ghost"
            disabled={testing || sending}
            onClick={() => void sendTest()}
          >
            {testing ? "Sending test…" : "Send test"}
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={sending || testing || !subject.trim() || !body.trim() || !roles.length}
            onClick={() => void sendBroadcast()}
          >
            {sending ? "Sending…" : "Send promotional email"}
          </button>
        </div>

        {status ? (
          <p
            className={statusTone === "error" ? "form-error" : "muted"}
            style={
              statusTone === "ok"
                ? { color: "#166534", fontWeight: 600 }
                : undefined
            }
            role="status"
          >
            {status}
          </p>
        ) : null}
      </div>
    </div>
  );
}
