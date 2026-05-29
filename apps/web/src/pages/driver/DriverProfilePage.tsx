import { FormEvent, useEffect, useState } from "react";
import { api } from "../../api/client";
import { AccountProfileShell } from "../../components/account/AccountProfileShell";
import type {
  AccountField,
  AccountHighlight,
  AccountStat,
} from "../../components/account/accountProfileUtils";
import { useAuth } from "../../context/AuthContext";
import { formatDriverStatus, useDriverMe } from "./types";

export function DriverProfilePage() {
  const { user, token, refreshUser } = useAuth();
  const { me, loading, refresh } = useDriverMe();
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState("available");
  const [licenseNo, setLicenseNo] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [bio, setBio] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!me?.driverProfile) return;
    setStatus(me.driverProfile.status);
    setLicenseNo(me.driverProfile.licenseNo ?? "");
    setVehicle(me.driverProfile.vehicle ?? "");
    setBio(me.driverProfile.bio ?? "");
  }, [me]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setMessage("");
    try {
      await api("/driver/profile", {
        method: "PATCH",
        token,
        body: JSON.stringify({ status, licenseNo, vehicle, bio }),
      });
      await refresh();
      await refreshUser();
      setEditing(false);
      setMessage("Profile updated.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !user) {
    return <p className="muted">Loading profile…</p>;
  }

  const dp = me?.driverProfile;
  const stats: AccountStat[] = [
    {
      label: "Status",
      value: formatDriverStatus(dp?.status ?? "available"),
      tone: "accent",
    },
    { label: "Vehicle", value: dp?.vehicle?.trim() || "Not set" },
  ];

  const fields: AccountField[] = editing
    ? []
    : [
        { label: "License", value: dp?.licenseNo?.trim() || "—" },
        { label: "Vehicle", value: dp?.vehicle?.trim() || "—" },
        { label: "Notes", value: dp?.bio?.trim() || "No notes yet" },
      ];

  const highlights: AccountHighlight[] = [
    {
      id: "today",
      label: "Field operations",
      value: formatDriverStatus(dp?.status ?? "available"),
      description: user.agencyDriver
        ? `${user.agencyDriver.agencyName} · open today’s route plan`
        : "Pickups, legs, and guest counts for today.",
      to: "/dashboard/driver",
      span: 2,
    },
  ];

  return (
    <AccountProfileShell
      variant="embedded"
      name={me?.name ?? user.name}
      phone={me?.phone ?? user.phone}
      role="DRIVER"
      email={user.email}
      walletBalance={user.walletBalance}
      stats={stats}
      fields={fields}
      highlights={highlights}
      tagline={user.agencyDriver ? `Assigned to ${user.agencyDriver.agencyName}` : null}
      actions={[
        { label: "Today's schedule", to: "/dashboard/driver", variant: "teal" },
        { label: "Assigned tours", to: "/dashboard/driver/assigned" },
      ]}
    >
      <div className="account-profile-edit-toolbar">
        <label className="sr-only" htmlFor="driver-status">
          Availability
        </label>
        <select
          id="driver-status"
          className="agency-filter"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setEditing(true);
          }}
        >
          <option value="available">Available</option>
          <option value="on_tour">On tour</option>
          <option value="off_duty">Off duty</option>
        </select>
        {!editing ? (
          <button type="button" className="btn btn-primary btn-nav" onClick={() => setEditing(true)}>
            Edit details
          </button>
        ) : null}
      </div>

      {editing ? (
        <form className="form-grid" onSubmit={handleSave}>
          <label htmlFor="license">License number</label>
          <input id="license" value={licenseNo} onChange={(e) => setLicenseNo(e.target.value)} />
          <label htmlFor="vehicle">Vehicle</label>
          <input id="vehicle" value={vehicle} onChange={(e) => setVehicle(e.target.value)} />
          <label htmlFor="bio">Bio / availability notes</label>
          <textarea id="bio" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
          <div className="account-profile-actions" style={{ padding: 0 }}>
            <button type="submit" className="btn btn-primary btn-nav" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-nav"
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {message ? <p className="account-profile-status-msg">{message}</p> : null}
    </AccountProfileShell>
  );
}
