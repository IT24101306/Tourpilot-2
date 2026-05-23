import { FormEvent, useEffect, useState } from "react";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { formatDriverStatus, useDriverMe } from "./types";

export function DriverProfilePage() {
  const { token, refreshUser } = useAuth();
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

  if (loading) return <p className="muted">Loading…</p>;

  return (
    <>
      <div className="agency-panel-head">
        <h2>Driver Profile</h2>
        <p>Keep your availability and contact details up to date.</p>
      </div>

      <div className="agency-tools">
        <select
          className="agency-filter"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setEditing(true);
          }}
          aria-label="Update driver status"
        >
          <option value="available">Available</option>
          <option value="on_tour">On Tour</option>
          <option value="off_duty">Off Duty</option>
        </select>
        <button type="button" className="btn btn-primary" onClick={() => setEditing(true)}>
          Edit Profile
        </button>
      </div>

      {editing ? (
        <form className="form-grid agency-panel" onSubmit={handleSave}>
          <label htmlFor="license">License</label>
          <input id="license" value={licenseNo} onChange={(e) => setLicenseNo(e.target.value)} />
          <label htmlFor="vehicle">Vehicle</label>
          <input id="vehicle" value={vehicle} onChange={(e) => setVehicle(e.target.value)} />
          <label htmlFor="bio">Bio / notes</label>
          <input id="bio" value={bio} onChange={(e) => setBio(e.target.value)} />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              Save Changes
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="agency-table-wrap">
          <table className="agency-table">
            <tbody>
              <tr>
                <th style={{ width: 220 }}>Driver Name</th>
                <td>{me?.name}</td>
              </tr>
              <tr>
                <th>Phone</th>
                <td>{me?.phone}</td>
              </tr>
              <tr>
                <th>License</th>
                <td>{me?.driverProfile?.licenseNo || "—"}</td>
              </tr>
              <tr>
                <th>Vehicle</th>
                <td>{me?.driverProfile?.vehicle || "—"}</td>
              </tr>
              <tr>
                <th>Status</th>
                <td>{formatDriverStatus(me?.driverProfile?.status ?? "available")}</td>
              </tr>
              <tr>
                <th>Bio</th>
                <td>{me?.driverProfile?.bio || "No notes"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {message && <p className="muted" style={{ marginTop: 12 }}>{message}</p>}
    </>
  );
}
