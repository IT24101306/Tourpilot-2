import { useCallback, useEffect, useState } from "react";
import { formatSessionInactivity } from "@tourpilot/shared";
import { api } from "../../api/client";
import { useAuth, type AgencyFeatures, DEFAULT_AGENCY_FEATURES } from "../../context/AuthContext";
import { useConfirmAction } from "../../components/confirm/ConfirmActionContext";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import { WalletAdjustModal } from "../../components/admin/WalletAdjustModal";
import { AgencyFeaturesModal } from "../../components/admin/AgencyFeaturesModal";
import { LoginFeeModal } from "../../components/admin/LoginFeeModal";
import { UserFormModal, type UserFormValues } from "../../components/admin/UserFormModal";
import type { AdminUser } from "./types";

const ROLES = ["", "TOURIST", "AGENCY", "INFLUENCER", "DRIVER", "ADMIN"] as const;

function errMessage(e: unknown, fallback: string) {
  if (e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string") {
    return (e as { message: string }).message;
  }
  return fallback;
}

export function AdminUsersPage() {
  const { token, user: me } = useAuth();
  const { requestConfirm } = useConfirmAction();
  const [rows, setRows] = useState<AdminUser[]>([]);
  const [role, setRole] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [adjustUser, setAdjustUser] = useState<AdminUser | null>(null);
  const [featuresUser, setFeaturesUser] = useState<AdminUser | null>(null);
  const [feeUser, setFeeUser] = useState<AdminUser | null>(null);
  const [formMode, setFormMode] = useState<"create" | "edit" | "duplicate" | null>(null);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
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
        ? "The user can sign in and use the platform again. If they own an agency, the public storefront becomes visible again."
        : "The user cannot sign in. Agency storefronts, tours, and offers are hidden from public pages.",
      confirmLabel: nextActive ? "Enable user" : "Disable user",
      variant: nextActive ? "default" : "danger",
      summary: [
        { label: "User", value: u.name },
        { label: "Role", value: u.role },
        { label: "Phone", value: u.phone },
        { label: "Current status", value: u.isActive ? "Active" : "Disabled" },
        { label: "New status", value: nextActive ? "Active" : "Disabled" },
        ...(u.role === "AGENCY"
          ? [
              {
                label: "Public agency page",
                value: nextActive ? "Visible (if approved)" : "Hidden",
              },
            ]
          : []),
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

  function deleteUser(u: AdminUser) {
    if (!token) return;
    if (me?.id === u.id) {
      setMsg("You cannot delete your own admin account.");
      return;
    }
    requestConfirm({
      title: "Delete user permanently?",
      description:
        "This cannot be undone. The account, wallet ledger, and linked agency/influencer/driver profiles are removed. Inquiries tied to this user (or their agency) are deleted too.",
      confirmLabel: "Delete forever",
      variant: "danger",
      summary: [
        { label: "User", value: u.name },
        { label: "Role", value: u.role },
        { label: "Phone", value: u.phone },
        ...(u.agency
          ? [
              { label: "Agency also deleted", value: u.agency.name },
              { label: "Agency tours / offers", value: "Removed with agency" },
            ]
          : []),
      ],
      onConfirm: async () => {
        setSaving(true);
        try {
          await api(`/admin/users/${u.id}`, { method: "DELETE", token });
          setMsg(`Deleted ${u.name}.`);
          await load();
        } catch (e) {
          setMsg(errMessage(e, "Could not delete user."));
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

  function changeRole(u: AdminUser, nextRole: string) {
    if (!token || nextRole === u.role) return;
    requestConfirm({
      title: "Change user role?",
      description:
        "Changing role updates what the account can access. Agency/influencer profiles are not auto-created or removed.",
      confirmLabel: "Change role",
      variant: "danger",
      summary: [
        { label: "User", value: u.name },
        { label: "Phone", value: u.phone },
        { label: "Current role", value: u.role },
        { label: "New role", value: nextRole },
      ],
      onConfirm: async () => {
        setSaving(true);
        try {
          await api(`/admin/users/${u.id}`, {
            method: "PATCH",
            token,
            body: JSON.stringify({ role: nextRole }),
          });
          setMsg(`Role updated for ${u.name}.`);
          await load();
        } catch {
          setMsg("Could not change role.");
        } finally {
          setSaving(false);
        }
      },
    });
  }

  async function saveLoginFee(loginFeeLkr: number | null) {
    if (!token || !feeUser) return;
    setSaving(true);
    try {
      await api(`/admin/users/${feeUser.id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ loginFeeLkr }),
      });
      setMsg(
        loginFeeLkr == null
          ? `Login fee reset to role default for ${feeUser.name}.`
          : `Custom login fee set for ${feeUser.name}.`
      );
      setFeeUser(null);
      await load();
    } catch {
      setMsg("Could not update login fee.");
    } finally {
      setSaving(false);
    }
  }

  async function saveUserForm(values: UserFormValues) {
    if (!token || !formMode) return;
    setSaving(true);
    try {
      const email = values.email.trim() ? values.email.trim() : null;
      if (formMode === "duplicate" && editUser) {
        const wallet = Number(values.walletBalance ?? 0);
        const feeRaw = values.loginFeeLkr?.trim() ?? "";
        const loginFeeLkr =
          feeRaw === "" ? undefined : Math.max(0, Math.round(Number(feeRaw)));
        const agencyName = values.agencyName?.trim();
        const created = await api<{
          name: string;
          phone: string;
          agency: {
            name: string;
            entitiesCloned: number;
            groupsCloned: number;
            toursCloned: number;
          } | null;
        }>(`/admin/users/${editUser.id}/duplicate`, {
          method: "POST",
          token,
          body: JSON.stringify({
            name: values.name,
            phone: values.phone,
            email,
            role: values.role,
            isActive: values.isActive,
            walletBalance: Number.isFinite(wallet) ? Math.max(0, Math.round(wallet)) : 0,
            ...(loginFeeLkr !== undefined && Number.isFinite(loginFeeLkr)
              ? { loginFeeLkr }
              : {}),
            ...(agencyName ? { agencyName } : {}),
          }),
        });
        const catalogNote = created.agency
          ? ` Cloned ${created.agency.entitiesCloned} entities, ${created.agency.groupsCloned} groups, ${created.agency.toursCloned} tours.`
          : "";
        setMsg(`Duplicated as ${created.name} (${created.phone}).${catalogNote}`);
      } else if (formMode === "create") {
        const wallet = Number(values.walletBalance ?? 0);
        const feeRaw = values.loginFeeLkr?.trim() ?? "";
        const loginFeeLkr =
          feeRaw === "" ? undefined : Math.max(0, Math.round(Number(feeRaw)));
        await api(`/admin/users`, {
          method: "POST",
          token,
          body: JSON.stringify({
            name: values.name,
            phone: values.phone,
            email,
            role: values.role,
            isActive: values.isActive,
            walletBalance: Number.isFinite(wallet) ? Math.max(0, Math.round(wallet)) : 0,
            ...(loginFeeLkr !== undefined && Number.isFinite(loginFeeLkr)
              ? { loginFeeLkr }
              : {}),
          }),
        });
        setMsg(`Created ${values.name}.`);
      } else if (editUser) {
        await api(`/admin/users/${editUser.id}`, {
          method: "PATCH",
          token,
          body: JSON.stringify({
            name: values.name,
            phone: values.phone,
            email,
            role: values.role,
            isActive: values.isActive,
          }),
        });
        setMsg(`Updated ${values.name}.`);
      }
      setFormMode(null);
      setEditUser(null);
      await load();
    } catch (e) {
      setMsg(
        errMessage(
          e,
          formMode === "edit"
            ? "Could not update user."
            : formMode === "duplicate"
              ? "Could not duplicate user."
              : "Could not create user."
        )
      );
    } finally {
      setSaving(false);
    }
  }

  function saveFeatures(payload: {
    features: AgencyFeatures;
    sessionInactivityMinutes: number | null;
  }) {
    if (!token || !featuresUser?.agency) return;
    const agency = featuresUser.agency;
    const { features, sessionInactivityMinutes } = payload;
    requestConfirm({
      title: "Update agency features?",
      description: "The agency dashboard will show or hide these modules.",
      confirmLabel: "Save features",
      summary: [
        { label: "Agency", value: agency.name },
        { label: "Owner", value: featuresUser.name },
        { label: "Ready-made tours", value: features.readyMadeTours ? "On" : "Off" },
        { label: "Custom inquiries", value: features.customInquiries ? "On" : "Off" },
        {
          label: "Negotiations → bookings",
          value: features.negotiationsBookings ? "On" : "Off",
        },
        { label: "Offers", value: features.offers ? "On" : "Off" },
        { label: "Display", value: features.display ? "On" : "Off" },
        {
          label: "Drivers & Partners",
          value: features.driversAndPartners ? "On" : "Off",
        },
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
        setSaving(true);
        try {
          await api(`/admin/agencies/${agency.id}/features`, {
            method: "PATCH",
            token,
            body: JSON.stringify({ ...features, sessionInactivityMinutes }),
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
        subtitle="Full account control: create, edit, wallet, fees, features, enable/disable, delete."
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
        <button
          type="button"
          className="btn btn-primary"
          disabled={saving}
          onClick={() => {
            setEditUser(null);
            setFormMode("create");
          }}
        >
          Create user
        </button>
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
                <th>Login fee</th>
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
                    {u.email && (
                      <>
                        <br />
                        <span className="muted">{u.email}</span>
                      </>
                    )}
                    {u.agency && (
                      <>
                        <br />
                        <span className="muted">{u.agency.name}</span>
                      </>
                    )}
                  </td>
                  <td>
                    <select
                      className="agency-filter"
                      value={u.role}
                      disabled={saving}
                      aria-label={`Role for ${u.name}`}
                      onChange={(e) => changeRole(u, e.target.value)}
                    >
                      {ROLES.filter(Boolean).map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>LKR {u.walletBalance.toLocaleString()}</td>
                  <td>
                    LKR {(u.loginFee ?? 0).toLocaleString()}
                    {u.loginFeeOverride != null ? (
                      <>
                        <br />
                        <span className="muted">Custom</span>
                      </>
                    ) : (
                      <>
                        <br />
                        <span className="muted">Role default</span>
                      </>
                    )}
                  </td>
                  <td>{u.isActive ? "Active" : "Disabled"}</td>
                  <td className="gov-table-actions">
                    <button
                      type="button"
                      className="btn btn-ghost btn-nav"
                      disabled={saving}
                      onClick={() => {
                        setEditUser(u);
                        setFormMode("edit");
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-nav"
                      disabled={saving}
                      title="Copy this account; you must enter a new phone number"
                      onClick={() => {
                        setEditUser(u);
                        setFormMode("duplicate");
                      }}
                    >
                      Duplicate
                    </button>
                    {(u.agency || u.role === "AGENCY") && (
                      <button
                        type="button"
                        className="btn btn-primary btn-nav"
                        disabled={!u.agency || saving}
                        title={
                          u.agency
                            ? "Toggle agency feature modules"
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
                      onClick={() => setFeeUser(u)}
                    >
                      Login fee
                    </button>
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
                    <button
                      type="button"
                      className="btn gov-btn-danger-outline btn-nav"
                      disabled={saving || me?.id === u.id}
                      title={me?.id === u.id ? "You cannot delete your own account" : "Delete permanently"}
                      onClick={() => deleteUser(u)}
                    >
                      Delete
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

      <LoginFeeModal
        open={!!feeUser}
        userName={feeUser?.name ?? ""}
        role={feeUser?.role ?? ""}
        effectiveFee={feeUser?.loginFee ?? 0}
        override={feeUser?.loginFeeOverride ?? null}
        loading={saving}
        onClose={() => setFeeUser(null)}
        onSave={saveLoginFee}
      />

      <AgencyFeaturesModal
        agencyName={featuresUser?.agency?.name ?? ""}
        open={!!featuresUser?.agency}
        loading={saving}
        initial={{
          ...DEFAULT_AGENCY_FEATURES,
          ...(featuresUser?.agency?.features ?? {}),
        }}
        initialSessionInactivityMinutes={
          featuresUser?.agency?.sessionInactivityMinutes ??
          (featuresUser?.agency?.sessionInactivityHours != null
            ? featuresUser.agency.sessionInactivityHours * 60
            : null)
        }
        onClose={() => setFeaturesUser(null)}
        onSave={saveFeatures}
      />

      <UserFormModal
        open={formMode != null}
        mode={formMode ?? "create"}
        loading={saving}
        sourceLabel={
          formMode === "duplicate" && editUser
            ? `${editUser.name} · ${editUser.phone}`
            : null
        }
        showAgencyName={formMode === "duplicate" && Boolean(editUser?.agency)}
        initial={
          formMode === "edit" && editUser
            ? {
                name: editUser.name,
                phone: editUser.phone,
                email: editUser.email ?? "",
                role: editUser.role as UserFormValues["role"],
                isActive: editUser.isActive,
              }
            : formMode === "duplicate" && editUser
              ? {
                  name: editUser.name,
                  phone: "",
                  email: editUser.email ?? "",
                  role: editUser.role as UserFormValues["role"],
                  isActive: editUser.isActive,
                  walletBalance: String(Math.round(editUser.walletBalance) || 0),
                  loginFeeLkr:
                    editUser.loginFeeOverride != null
                      ? String(editUser.loginFeeOverride)
                      : "",
                  agencyName: editUser.agency?.name ?? "",
                }
              : null
        }
        onClose={() => {
          setFormMode(null);
          setEditUser(null);
        }}
        onSave={saveUserForm}
      />
    </div>
  );
}
