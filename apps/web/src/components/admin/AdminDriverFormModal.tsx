import { FormEvent, useEffect, useState } from "react";

export type AdminDriverFormValues = {
  name: string;
  phone: string;
  email: string;
  licenseNo: string;
  vehicle: string;
  status: "Available" | "On Tour" | "Off Duty";
  agencyId: string;
  isActive: boolean;
};

type AgencyOption = { id: string; name: string; slug: string };

type Props = {
  open: boolean;
  loading: boolean;
  agencies: AgencyOption[];
  onClose: () => void;
  onSave: (values: AdminDriverFormValues) => void;
};

const EMPTY: AdminDriverFormValues = {
  name: "",
  phone: "",
  email: "",
  licenseNo: "",
  vehicle: "",
  status: "Available",
  agencyId: "",
  isActive: true,
};

export function AdminDriverFormModal({ open, loading, agencies, onClose, onSave }: Props) {
  const [form, setForm] = useState<AdminDriverFormValues>(EMPTY);

  useEffect(() => {
    if (open) setForm(EMPTY);
  }, [open]);

  if (!open) return null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) return;
    onSave({
      ...form,
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      licenseNo: form.licenseNo.trim(),
      vehicle: form.vehicle.trim(),
    });
  }

  return (
    <div className="gov-modal-backdrop" role="presentation" onClick={onClose}>
      <div className="gov-modal" role="dialog" onClick={(e) => e.stopPropagation()}>
        <h3>Create driver</h3>
        <p className="muted">
          Creates a driver login account (OTP at /login). Optionally link them to an agency roster.
        </p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="admin-driver-name">Name</label>
          <input
            id="admin-driver-name"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            required
            placeholder="Nimal Perera"
          />

          <label htmlFor="admin-driver-phone">Phone</label>
          <input
            id="admin-driver-phone"
            type="tel"
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            required
            placeholder="+94771234567"
          />

          <label htmlFor="admin-driver-email">Email (optional)</label>
          <input
            id="admin-driver-email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            placeholder="driver@example.com"
          />

          <label htmlFor="admin-driver-license">License No</label>
          <input
            id="admin-driver-license"
            value={form.licenseNo}
            onChange={(e) => setForm((p) => ({ ...p, licenseNo: e.target.value }))}
            placeholder="B321-9845"
          />

          <label htmlFor="admin-driver-vehicle">Vehicle</label>
          <input
            id="admin-driver-vehicle"
            value={form.vehicle}
            onChange={(e) => setForm((p) => ({ ...p, vehicle: e.target.value }))}
            placeholder="Toyota KDH"
          />

          <label htmlFor="admin-driver-status">Status</label>
          <select
            id="admin-driver-status"
            value={form.status}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                status: e.target.value as AdminDriverFormValues["status"],
              }))
            }
          >
            <option value="Available">Available</option>
            <option value="On Tour">On Tour</option>
            <option value="Off Duty">Off Duty</option>
          </select>

          <label htmlFor="admin-driver-agency">Agency (optional)</label>
          <select
            id="admin-driver-agency"
            value={form.agencyId}
            onChange={(e) => setForm((p) => ({ ...p, agencyId: e.target.value }))}
          >
            <option value="">No agency link</option>
            {agencies.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>

          <label className="gov-check-row">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
            />
            <span>Active (can sign in)</span>
          </label>

          <div className="gov-form-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Saving…" : "Create driver"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
