import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatSessionInactivity } from "@tourpilot/shared";
import { api } from "../../api/client";
import { useAuth, type AgencyFeatures, DEFAULT_AGENCY_FEATURES } from "../../context/AuthContext";
import { useConfirmAction } from "../../components/confirm/ConfirmActionContext";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import { RejectAgencyModal } from "../../components/admin/RejectAgencyModal";
import { AgencyKycModal } from "../../components/admin/AgencyKycModal";
import { AgencyFeaturesModal } from "../../components/admin/AgencyFeaturesModal";
import type { AgencyKycRecord } from "@tourpilot/shared";
import type { AdminAgency } from "./types";

const STATUSES = ["", "PENDING", "APPROVED", "SUSPENDED", "REJECTED"] as const;

export function AdminAgenciesPage() {
  const { token } = useAuth();
  const { requestConfirm } = useConfirmAction();
  const [rows, setRows] = useState<AdminAgency[]>([]);
  const [filter, setFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: string; name: string } | null>(null);
  const [kycTarget, setKycTarget] = useState<{ name: string; kyc: AgencyKycRecord | null } | null>(
    null
  );
  const [featuresAgency, setFeaturesAgency] = useState<AdminAgency | null>(null);
  const [savingFeatures, setSavingFeatures] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const q = filter ? `?status=${filter}` : "";
    const data = await api<AdminAgency[]>(`/admin/agencies${q}`, { token });
    setRows(data);
    setLoading(false);
  }, [token, filter]);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  function setStatus(agency: AdminAgency, status: string) {
    if (!token) return;
    requestConfirm({
      title: `Set agency to ${status.replace(/_/g, " ").toLowerCase()}?`,
      description: "This changes marketplace visibility and access for the agency.",
      confirmLabel: "Update status",
      variant: status === "SUSPENDED" || status === "REJECTED" ? "danger" : "default",
      summary: [
        { label: "Agency", value: agency.name },
        { label: "Owner", value: agency.owner.name },
        { label: "Current status", value: agency.status },
        { label: "New status", value: status },
      ],
      onConfirm: async () => {
        setWorkingId(agency.id);
        try {
          await api(`/admin/agencies/${agency.id}/status`, {
            method: "PATCH",
            token,
            body: JSON.stringify({ status }),
          });
          setMsg(`Status updated to ${status}.`);
          await load();
        } catch {
          setMsg("Update failed.");
        } finally {
          setWorkingId(null);
        }
      },
    });
  }

  async function reject(reason: string, sendEmail: boolean) {
    if (!token || !rejectTarget) return;
    setWorkingId(rejectTarget.id);
    try {
      await api(`/admin/agencies/${rejectTarget.id}/reject`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ reason, sendEmail }),
      });
      setMsg("Agency rejected.");
      setRejectTarget(null);
      await load();
    } catch {
      setMsg("Rejection failed.");
    } finally {
      setWorkingId(null);
    }
  }

  function saveFeatures(payload: {
    features: AgencyFeatures;
    sessionInactivityMinutes: number | null;
  }) {
    if (!token || !featuresAgency) return;
    const { features, sessionInactivityMinutes } = payload;
    requestConfirm({
      title: "Update agency features?",
      description: "The agency dashboard will show or hide these modules.",
      confirmLabel: "Save features",
      summary: [
        { label: "Agency", value: featuresAgency.name },
        { label: "Ready-made tours", value: features.readyMadeTours ? "On" : "Off" },
        { label: "Custom inquiries", value: features.customInquiries ? "On" : "Off" },
        {
          label: "Negotiations → bookings",
          value: features.negotiationsBookings ? "On" : "Off",
        },
        { label: "Offers", value: features.offers ? "On" : "Off" },
        { label: "Display", value: features.display ? "On" : "Off" },
        { label: "Drivers & Partners", value: features.driversAndPartners ? "On" : "Off" },
        { label: "Support", value: features.support ? "On" : "Off" },
        { label: "Wallet topup", value: features.walletTopup ? "On" : "Off" },
        { label: "Custom domain", value: features.customDomain ? "On" : "Off" },
        { label: "External website", value: features.externalStorefront ? "On" : "Off" },
        {
          label: "Session inactivity",
          value: features.sessionInactivityTimeout
            ? `On (${
                sessionInactivityMinutes != null
                  ? formatSessionInactivity(sessionInactivityMinutes)
                  : "platform default"
              })`
            : "Off",
        },
      ],
      onConfirm: async () => {
        setSavingFeatures(true);
        try {
          await api(`/admin/agencies/${featuresAgency.id}/features`, {
            method: "PATCH",
            token,
            body: JSON.stringify({ ...features, sessionInactivityMinutes }),
          });
          setMsg(`Features updated for ${featuresAgency.name}.`);
          setFeaturesAgency(null);
          await load();
        } catch {
          setMsg("Could not update features.");
        } finally {
          setSavingFeatures(false);
        }
      },
    });
  }

  return (
    <div className="module-shell module-governance">
      <ModuleHeader module="governance" title="Agencies" subtitle="Full marketplace operator control." />

      <div className="gov-toolbar">
        <select
          className="agency-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter by status"
        >
          {STATUSES.map((s) => (
            <option key={s || "all"} value={s}>
              {s || "All statuses"}
            </option>
          ))}
        </select>
      </div>

      {msg && <p className="gov-status-msg">{msg}</p>}
      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="gov-table-wrap">
          <table className="agency-table gov-table">
            <thead>
              <tr>
                <th>Agency</th>
                <th>Owner</th>
                <th>Status</th>
                <th>Tours</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td>
                    <strong>{a.name}</strong>
                    <br />
                    <span className="muted">{a.slug}</span>
                    {a.rejectionReason && (
                      <p className="gov-inline-warn">Rejected: {a.rejectionReason}</p>
                    )}
                  </td>
                  <td>
                    {a.owner.name}
                    <br />
                    <span className="muted">{a.owner.phone}</span>
                  </td>
                  <td>
                    <span className={`gov-status-badge gov-status-badge--${a.status.toLowerCase()}`}>
                      {a.status}
                    </span>
                  </td>
                  <td>{a.tourCount}</td>
                  <td className="gov-table-actions">
                    <button
                      type="button"
                      className="btn btn-primary btn-nav"
                      onClick={() => setFeaturesAgency(a)}
                    >
                      Features
                    </button>
                    {a.status === "APPROVED" && (
                      <Link to={`/agencies/${a.slug}`} className="btn btn-ghost btn-nav" target="_blank">
                        View
                      </Link>
                    )}
                    {a.kyc && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-nav"
                        onClick={() =>
                          setKycTarget({
                            name: a.name,
                            kyc: a.kyc as AgencyKycRecord,
                          })
                        }
                      >
                        View KYC
                      </button>
                    )}
                    {a.status === "PENDING" && (
                      <>
                        <button
                          type="button"
                          className="btn btn-primary btn-nav"
                          disabled={workingId === a.id}
                          onClick={() => setStatus(a, "APPROVED")}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-nav gov-btn-danger-outline"
                          onClick={() => setRejectTarget({ id: a.id, name: a.name })}
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {a.status === "APPROVED" && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-nav"
                        disabled={workingId === a.id}
                        onClick={() => setStatus(a, "SUSPENDED")}
                      >
                        Suspend
                      </button>
                    )}
                    {(a.status === "SUSPENDED" || a.status === "REJECTED") && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-nav"
                        disabled={workingId === a.id}
                        onClick={() => setStatus(a, "APPROVED")}
                      >
                        Reinstate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AgencyKycModal
        agencyName={kycTarget?.name ?? ""}
        kyc={kycTarget?.kyc ?? null}
        open={!!kycTarget}
        onClose={() => setKycTarget(null)}
      />

      <RejectAgencyModal
        agencyName={rejectTarget?.name ?? ""}
        open={!!rejectTarget}
        loading={!!workingId}
        onClose={() => setRejectTarget(null)}
        onConfirm={reject}
      />

      <AgencyFeaturesModal
        agencyName={featuresAgency?.name ?? ""}
        open={!!featuresAgency}
        loading={savingFeatures}
        initial={{
          ...DEFAULT_AGENCY_FEATURES,
          ...(featuresAgency?.features ?? {}),
        }}
        initialSessionInactivityMinutes={
          featuresAgency?.sessionInactivityMinutes ??
          (featuresAgency?.sessionInactivityHours != null
            ? featuresAgency.sessionInactivityHours * 60
            : null)
        }
        onClose={() => setFeaturesAgency(null)}
        onSave={saveFeatures}
      />
    </div>
  );
}
