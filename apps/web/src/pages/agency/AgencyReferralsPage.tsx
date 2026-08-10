import { FormEvent, useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { isValidInternationalPhone, toStoredPhone } from "@tourpilot/shared";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useConfirmAction } from "../../components/confirm/ConfirmActionContext";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import { OpsMetricStrip } from "../../components/module/OpsMetricStrip";
import "../../styles/dashboard.css";

type InviteRow = {
  id: string;
  inviteePhone: string;
  status: "PENDING" | "REGISTERED" | "APPROVED" | "CANCELLED" | "EXPIRED";
  createdAt: string;
  cancelledAt: string | null;
  registeredAgency: {
    id: string;
    name: string;
    slug: string;
    status: string;
    referralApprovedAt: string | null;
    referralRewardEndsAt: string | null;
  } | null;
};

type ReferralsPayload = {
  enabled: boolean;
  cap: number;
  loginFeePct: number;
  rewardMonths: number;
  successfulCount: number;
  remainingSlots: number;
  totalEarningsLkr: number;
  invites: InviteRow[];
};

function statusLabel(status: InviteRow["status"]) {
  switch (status) {
    case "PENDING":
      return "Waiting for signup";
    case "REGISTERED":
      return "Registered — awaiting approval";
    case "APPROVED":
      return "Successful";
    case "CANCELLED":
      return "Cancelled";
    case "EXPIRED":
      return "Expired";
    default:
      return status;
  }
}

export function AgencyReferralsPage() {
  const { token, user } = useAuth();
  const { requestConfirm } = useConfirmAction();
  const [data, setData] = useState<ReferralsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const isOwner = user?.agencyMembership === "owner";

  const refresh = useCallback(async () => {
    if (!token) return;
    const payload = await api<ReferralsPayload>("/agency/referrals", { token });
    setData(payload);
  }, [token]);

  useEffect(() => {
    if (!token || !isOwner) return;
    setLoading(true);
    refresh()
      .catch((err) => {
        console.error(err);
        setStatus(err instanceof ApiError ? err.message : "Could not load referrals.");
      })
      .finally(() => setLoading(false));
  }, [token, isOwner, refresh]);

  if (user && user.agencyMembership !== "owner") {
    return <Navigate to="/dashboard/agency" replace />;
  }

  function onInvite(e: FormEvent) {
    e.preventDefault();
    if (!token || !phone.trim() || !data) return;

    const normalized = toStoredPhone(phone);
    if (!isValidInternationalPhone(normalized)) {
      setStatus("Enter a valid international phone (e.g. +94771234567).");
      return;
    }

    requestConfirm({
      title: "Invite this agency?",
      description:
        "They must register as an agency with this exact phone. Successful referrals count toward your limit.",
      confirmLabel: "Send invite",
      summary: [
        { label: "Phone", value: normalized },
        { label: "Slots left", value: String(data.remainingSlots) },
      ],
      onConfirm: async () => {
        setSaving(true);
        setStatus("");
        try {
          await api("/agency/referrals/invite", {
            method: "POST",
            token,
            body: JSON.stringify({ phone: normalized }),
          });
          setPhone("");
          await refresh();
          setStatus("Invite saved. They must register with this exact phone.");
        } catch (err) {
          setStatus(err instanceof ApiError ? err.message : "Could not create invite.");
        } finally {
          setSaving(false);
        }
      },
    });
  }

  function onCancel(invite: InviteRow) {
    if (!token) return;
    requestConfirm({
      title: "Cancel this invite?",
      description: "The phone can be re-invited later by you if still available.",
      confirmLabel: "Cancel invite",
      variant: "danger",
      summary: [{ label: "Phone", value: invite.inviteePhone }],
      onConfirm: async () => {
        try {
          await api(`/agency/referrals/${invite.id}`, { method: "DELETE", token });
          await refresh();
          setStatus("Invite cancelled.");
        } catch (err) {
          setStatus(err instanceof ApiError ? err.message : "Could not cancel invite.");
        }
      },
    });
  }

  return (
    <div className="module-shell">
      <ModuleHeader
        module="partner"
        title="Refer agencies"
        subtitle={`Invite up to ${data?.cap ?? 5} agencies by phone. You earn ${
          data?.loginFeePct ?? 25
        }% of their login fee for ${data?.rewardMonths ?? 12} months after they are approved.`}
      />

      {status && <p className="gov-status-msg">{status}</p>}

      {loading || !data ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          <p className="muted" style={{ marginTop: 0 }}>
            Invite up to {data.cap} agencies by phone. You earn {data.loginFeePct}% of their login
            fee for {data.rewardMonths} months after they are approved.
          </p>

          <OpsMetricStrip
            metrics={[
              {
                id: "successful",
                label: "Successful",
                value: `${data.successfulCount}/${data.cap}`,
                hint: "Approved referrals",
              },
              {
                id: "slots",
                label: "Slots left",
                value: data.remainingSlots,
                hint: data.enabled ? "Available invites" : "Program disabled",
              },
              {
                id: "earnings",
                label: "Earnings",
                value: `${data.totalEarningsLkr.toLocaleString()} Credits`,
                hint: "Referral rewards",
              },
            ]}
          />

          {!data.enabled ? (
            <p className="muted">Agency referrals are currently disabled by the platform.</p>
          ) : (
            <form
              className="entity-form"
              onSubmit={onInvite}
              style={{ marginTop: "1.25rem", maxWidth: 420 }}
            >
              <h3 style={{ margin: "0 0 0.5rem" }}>Invite by phone</h3>
              <p className="muted" style={{ margin: "0 0 0.75rem" }}>
                Enter the phone they will use to register. First invite for a number wins.
              </p>
              <label>
                Phone
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+94771234567"
                  disabled={saving || data.remainingSlots <= 0}
                  required
                />
              </label>
              <div className="form-actions" style={{ marginTop: "0.75rem" }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving || data.remainingSlots <= 0 || !phone.trim()}
                >
                  {data.remainingSlots <= 0
                    ? "Limit reached"
                    : saving
                      ? "Saving…"
                      : "Invite agency"}
                </button>
              </div>
            </form>
          )}

          <section style={{ marginTop: "1.5rem" }}>
            <h3>Your invites</h3>
            {data.invites.length === 0 ? (
              <p className="muted">No invites yet.</p>
            ) : (
              <div className="gov-table-wrap">
                <table className="gov-table">
                  <thead>
                    <tr>
                      <th>Phone</th>
                      <th>Status</th>
                      <th>Agency</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.invites.map((invite) => (
                      <tr key={invite.id}>
                        <td>{invite.inviteePhone}</td>
                        <td>{statusLabel(invite.status)}</td>
                        <td>{invite.registeredAgency?.name ?? "—"}</td>
                        <td>
                          {invite.status === "PENDING" && (
                            <button
                              type="button"
                              className="btn btn-ghost"
                              onClick={() => onCancel(invite)}
                            >
                              Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
