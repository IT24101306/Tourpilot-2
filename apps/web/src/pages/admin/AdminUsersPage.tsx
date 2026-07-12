import { useCallback, useEffect, useState } from "react";
import { api } from "../../api/client";
import { useAuth, type AgencyFeatures, DEFAULT_AGENCY_FEATURES } from "../../context/AuthContext";
import { useConfirmAction } from "../../components/confirm/ConfirmActionContext";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import { WalletAdjustModal } from "../../components/admin/WalletAdjustModal";
import { AgencyFeaturesModal } from "../../components/admin/AgencyFeaturesModal";
import type { AdminUser } from "./types";

const ROLES = ["", "TOURIST", "AGENCY", "INFLUENCER", "DRIVER", "ADMIN"] as const;

export function AdminUsersPage() {
  const { token } = useAuth();
  const { requestConfirm } = useConfirmAction();
  const [rows, setRows] = useState<AdminUser[]>([]);
  const [role, setRole] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [adjustUser, setAdjustUser] = useState<AdminUser | null>(null);
  const [featuresUser, setFeaturesUser] = useState<AdminUser | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (role) params.set("role", role);
    if (q.trim()) params.set("q", q.trim());
    const data = await api<AdminUser[]>(`/admin/users?${params}`, { token });
    setRows(data);
    setLoading(false);
  }, [token, role, q]);

  useEffect(() => {
    const t = setTimeout(() => load().catch(console.error), 300);
    return () => clearTimeout(t);
  }, [load]);

  function toggleActive(u: AdminUser) {
    if (!token) return;
    const nextActive = !u.isActive;
    requestConfirm({
      title: nextActive ? "Enable user?" : "Disable user?",
      description: nextActive
        ? "The user can sign in and use the platform again."
        : "The user will be blocked from signing in.",
      confirmLabel: nextActive ? "Enable user" : "Disable user",
      variant: nextActive ? "default" : "danger",
      summary: [
        { label: "User", value: u.name },
        { label: "Role", value: u.role },
        { label: "Phone", value: u.phone },
        { label: "Current status", value: u.isActive ? "Active" : "Disabled" },
        { label: "New status", value: nextActive ? "Active" : "Disabled" },
      ],
      onConfirm: async () => {
        setSaving(true);
        try {
          await api(`/admin/users/${u.id}`, {
            method: "PATCH",
            token,
            body: JSON.stringify({ isActive: nextActive }),
          });
          setMsg(nextActive ? "User activated." : "User deactivated.");
          await load();
        } finally {
          setSaving(false);
        }
      },
    });
  }

  async function adjust(amount: number, note: string) {
    if (!token || !adjustUser) return;
    setSaving(true);
    try {
      await api(`/admin/users/${adjustUser.id}/wallet-adjust`, {
        method: "POST",
        token,
        body: JSON.stringify({ amount, note }),
      });
      setMsg(`Wallet adjusted for ${adjustUser.name}.`);
      setAdjustUser(null);
      await load();
    } catch {
      setMsg("Adjustment failed.");
    } finally {
      setSaving(false);
    }
  }

  function saveFeatures(features: AgencyFeatures) {
    if (!token || !featuresUser?.agency) return;
    const agency = featuresUser.agency;
    requestConfirm({
      title: "Update agency features?",
      description: "The agency dashboard will show or hide these modules.",
      confirmLabel: "Save features",
      summary: [
        { label: "Agency", value: agency.name },
        { label: "Owner", value: featuresUser.name },
        {
          label: "Drivers & Partners",
          value: features.driversAndPartners ? "On" : "Off",
        },
        { label: "Support", value: features.support ? "On" : "Off" },
        { label: "Wallet topup", value: features.walletTopup ? "On" : "Off" },
        { label: "Offers", value: features.offers ? "On" : "Off" },
      ],
      onConfirm: async () => {
        setSaving(true);
        try {
          await api(`/admin/agencies/${agency.id}/features`, {
            method: "PATCH",
            token,
            body: JSON.stringify(features),
          });
          setMsg(`Features updated for ${agency.name}.`);
          setFeaturesUser(null);
          await load();
        } catch {
          setMsg("Could not update features.");
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
        title="Users"
        subtitle="Accounts, access, and agency feature entitlements."
      />

      <div className="gov-toolbar">
        <input
          type="search"
          placeholder="Search name or phone…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="gov-search"
        />
        <select className="agency-filter" value={role} onChange={(e) => setRole(e.target.value)}>
          {ROLES.map((r) => (
            <option key={r || "all"} value={r}>
              {r || "All roles"}
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
                <th>Name</th>
                <th>Role</th>
                <th>Wallet</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.name}</strong>
                    <br />
                    <span className="muted">{u.phone}</span>
                    {u.agency && (
                      <>
                        <br />
                        <span className="muted">{u.agency.name}</span>
                      </>
                    )}
                  </td>
                  <td>{u.role}</td>
                  <td>LKR {u.walletBalance.toLocaleString()}</td>
                  <td>{u.isActive ? "Active" : "Disabled"}</td>
                  <td className="gov-table-actions">
                    {(u.agency || u.role === "AGENCY") && (
                      <button
                        type="button"
                        className="btn btn-primary btn-nav"
                        disabled={!u.agency || saving}
                        title={
                          u.agency
                            ? "Toggle Drivers, Support, Wallet, Offers"
                            : "No agency profile linked to this user"
                        }
                        onClick={() => u.agency && setFeaturesUser(u)}
                      >
                        Features
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-ghost btn-nav"
                      onClick={() => setAdjustUser(u)}
                    >
                      Adjust wallet
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-nav"
                      disabled={saving}
                      onClick={() => toggleActive(u)}
                    >
                      {u.isActive ? "Disable" : "Enable"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <WalletAdjustModal
        userName={adjustUser?.name ?? ""}
        open={!!adjustUser}
        loading={saving}
        onClose={() => setAdjustUser(null)}
        onConfirm={adjust}
      />

      <AgencyFeaturesModal
        agencyName={featuresUser?.agency?.name ?? ""}
        open={!!featuresUser?.agency}
        loading={saving}
        initial={{
          ...DEFAULT_AGENCY_FEATURES,
          ...(featuresUser?.agency?.features ?? {}),
        }}
        onClose={() => setFeaturesUser(null)}
        onSave={saveFeatures}
      />
    </div>
  );
}
