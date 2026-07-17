import { FormEvent, useEffect, useState } from "react";
import type { UserRole } from "@tourpilot/shared";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useConfirmAction } from "../../components/confirm/ConfirmActionContext";
import { ModuleHeader } from "../../components/module/ModuleHeader";

type PlatformSettings = {
  loginFees: Record<UserRole, number>;
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

    requestConfirm({
      title: "Update role login fees?",
      description:
        "These amounts apply on each OTP login unless a user has a custom fee override.",
      confirmLabel: "Save fees",
      summary: FEE_ROLES.map((role) => ({
        label: role,
        value: `LKR ${loginFees[role].toLocaleString()}`,
      })),
      onConfirm: async () => {
        setSaving(true);
        try {
          const data = await api<PlatformSettings>("/admin/settings", {
            method: "PUT",
            token,
            body: JSON.stringify({ loginFees }),
          });
          setSettings(data);
          setMsg("Login fees saved.");
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
        subtitle="Default login fees by role. Override any account from Users."
      />

      {msg && <p className="gov-status-msg">{msg}</p>}

      {loading || !settings ? (
        <p className="muted">Loading…</p>
      ) : (
        <form className="gov-form-card" onSubmit={onSubmit}>
          <h3 className="gov-form-card__title">Login fees (LKR)</h3>
          <p className="muted">
            Charged when a non-admin user verifies OTP. Set 0 to disable for that role.
            {settings.updatedAt && (
              <>
                {" "}
                Last saved {new Date(settings.updatedAt).toLocaleString()}.
              </>
            )}
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

          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Save login fees"}
          </button>
        </form>
      )}
    </div>
  );
}
