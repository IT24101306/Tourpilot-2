import { FormEvent, useEffect, useMemo, useState } from "react";
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
  const [sending, setSending] = useState(false);

  const rolesKey = useMemo(() => roles.slice().sort().join(","), [roles]);

  useEffect(() => {
    if (!token) return;
    api<OfferOption[]>("/offers", { token })
      .then((list) => setOffers(list.filter((o) => o.isActive)))
      .catch(console.error);
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

  function toggleRole(role: Exclude<UserRole, "ADMIN">) {
    setRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  }

  async function sendTest(e: FormEvent) {
    e.preventDefault();
    if (!token || !testTo.trim()) return;
    setSending(true);
    setStatus("");
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
            subject,
            body,
            posterUrl: posterUrl.trim() || null,
            offerId: offerId || null,
            roles,
            testTo: testTo.trim(),
          }),
        }
      );
      if (result.sent && result.deliveryMode === "smtp") {
        setStatus(`Test email sent to ${testTo.trim()} via SMTP.`);
      } else if (result.sent && result.deliveryMode === "log") {
        setStatus(
          result.errors?.[0] ||
            "Logged to API console only (EMAIL_MODE=log). Configure SMTP to send real mail."
        );
      } else {
        setStatus(`Test failed: ${result.errors?.[0] || "unknown error"}`);
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Test send failed");
    } finally {
      setSending(false);
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
        setStatus("");
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
          setStatus(
            `Sent ${result.sent} of ${result.audience}` +
              (result.deliveryMode ? ` via ${result.deliveryMode}` : "") +
              (result.failed ? ` (${result.failed} failed)` : "") +
              (result.errors?.length ? `. ${result.errors[0]}` : "")
          );
        } catch (err) {
          setStatus(err instanceof Error ? err.message : "Broadcast failed");
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

      <form className="form-grid" style={{ maxWidth: 720 }} onSubmit={sendTest}>
        <label htmlFor="promo-subject">Subject</label>
        <input
          id="promo-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
          minLength={3}
          placeholder="Summer specials on TourPilot"
        />

        <label htmlFor="promo-body">Message</label>
        <textarea
          id="promo-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
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
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            id="promo-test"
            type="email"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="you@example.com"
            style={{ flex: 1, minWidth: 200 }}
          />
          <button
            type="submit"
            className="btn btn-ghost"
            disabled={sending || !subject.trim() || !body.trim() || !testTo.trim()}
          >
            Send test
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={sending || !subject.trim() || !body.trim() || !roles.length}
            onClick={() => void sendBroadcast()}
          >
            {sending ? "Sending…" : "Send promotional email"}
          </button>
        </div>

        {status && <p className="muted">{status}</p>}
      </form>
    </div>
  );
}
