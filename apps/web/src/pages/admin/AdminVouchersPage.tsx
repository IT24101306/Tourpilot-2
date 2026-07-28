import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useConfirmAction } from "../../components/confirm/ConfirmActionContext";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import { DashboardModal } from "../../components/DashboardModal";
import type { VoucherRow } from "../../types/billing";

type VoucherForm = {
  code: string;
  description: string;
  discountType: "FIXED_LKR" | "PERCENT";
  discountValue: string;
  maxUses: string;
  minInvoiceLkr: string;
  maxDiscountLkr: string;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
};

const emptyForm = (): VoucherForm => ({
  code: "",
  description: "",
  discountType: "FIXED_LKR",
  discountValue: "",
  maxUses: "",
  minInvoiceLkr: "",
  maxDiscountLkr: "",
  validFrom: "",
  validUntil: "",
  isActive: true,
});

function toDateInput(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function fromDateInput(value: string): string | null {
  if (!value.trim()) return null;
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

export function AdminVouchersPage() {
  const { token } = useAuth();
  const { requestConfirm } = useConfirmAction();
  const [rows, setRows] = useState<VoucherRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<VoucherRow | null>(null);
  const [form, setForm] = useState<VoucherForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  async function refresh() {
    if (!token) return;
    const list = await api<VoucherRow[]>("/admin/vouchers", { token });
    setRows(list);
  }

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    refresh()
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setStatus("");
    setModalOpen(true);
  }

  function openEdit(row: VoucherRow) {
    setEditing(row);
    setForm({
      code: row.code,
      description: row.description ?? "",
      discountType: row.discountType,
      discountValue: String(row.discountValue),
      maxUses: row.maxUses != null ? String(row.maxUses) : "",
      minInvoiceLkr: row.minInvoiceLkr != null ? String(row.minInvoiceLkr) : "",
      maxDiscountLkr: row.maxDiscountLkr != null ? String(row.maxDiscountLkr) : "",
      validFrom: toDateInput(row.validFrom),
      validUntil: toDateInput(row.validUntil),
      isActive: row.isActive,
    });
    setStatus("");
    setModalOpen(true);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setStatus("");
    try {
      const payload = {
        code: form.code.trim(),
        description: form.description.trim() || null,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        maxUses: form.maxUses.trim() ? Number(form.maxUses) : null,
        minInvoiceLkr: form.minInvoiceLkr.trim() ? Number(form.minInvoiceLkr) : null,
        maxDiscountLkr: form.maxDiscountLkr.trim() ? Number(form.maxDiscountLkr) : null,
        validFrom: fromDateInput(form.validFrom),
        validUntil: fromDateInput(form.validUntil),
        isActive: form.isActive,
      };
      if (editing) {
        await api(`/admin/vouchers/${editing.id}`, {
          method: "PATCH",
          token,
          body: JSON.stringify(payload),
        });
      } else {
        await api("/admin/vouchers", {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });
      }
      setModalOpen(false);
      await refresh();
    } catch (err) {
      setStatus(err instanceof ApiError ? err.message : "Failed to save voucher");
    } finally {
      setSaving(false);
    }
  }

  function deactivate(row: VoucherRow) {
    if (!token) return;
    requestConfirm({
      title: "Deactivate voucher?",
      confirmLabel: "Deactivate",
      variant: "danger",
      summary: [
        { label: "Code", value: row.code },
        {
          label: "Discount",
          value:
            row.discountType === "PERCENT"
              ? `${row.discountValue}%`
              : `LKR ${row.discountValue.toLocaleString()}`,
        },
      ],
      onConfirm: async () => {
        await api(`/admin/vouchers/${row.id}`, { method: "DELETE", token });
        await refresh();
      },
    });
  }

  return (
    <div className="module-shell module-governance">
      <ModuleHeader
        module="governance"
        title="Vouchers"
        subtitle="Create custom discount codes that tourists can redeem on invoices before paying."
      >
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          + Add voucher
        </button>
      </ModuleHeader>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="muted">No vouchers yet. Create one like LLT-202607-002.</p>
      ) : (
        <div className="gov-table-wrap">
          <table className="agency-table gov-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Discount</th>
                <th>Uses</th>
                <th>Validity</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.code}</strong>
                    {row.description ? <div className="muted">{row.description}</div> : null}
                  </td>
                  <td>
                    {row.discountType === "PERCENT"
                      ? `${row.discountValue}%`
                      : `LKR ${row.discountValue.toLocaleString()}`}
                  </td>
                  <td>
                    {row.usedCount}
                    {row.maxUses != null ? ` / ${row.maxUses}` : " / ∞"}
                  </td>
                  <td className="muted">
                    {row.validFrom || row.validUntil
                      ? `${toDateInput(row.validFrom) || "—"} → ${toDateInput(row.validUntil) || "—"}`
                      : "No expiry"}
                  </td>
                  <td>
                    <span className={`agency-status ${row.isActive ? "status-approved" : "status-suspended"}`}>
                      {row.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button type="button" className="mini-btn" onClick={() => openEdit(row)}>
                        Edit
                      </button>
                      {row.isActive && (
                        <button type="button" className="mini-btn" onClick={() => deactivate(row)}>
                          Deactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DashboardModal
        open={modalOpen}
        title={editing ? "Edit voucher" : "Add voucher"}
        subtitle="Tourists enter this code on the invoice before paying."
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={save}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>
              Voucher code <span className="field-required-mark">*</span>
            </label>
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="LLT-202607-002"
              required
            />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Description</label>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional note for admins"
            />
          </div>
          <div className="tour-meta-grid">
            <div className="field">
              <label>
                Discount type <span className="field-required-mark">*</span>
              </label>
              <select
                value={form.discountType}
                onChange={(e) =>
                  setForm({
                    ...form,
                    discountType: e.target.value as "FIXED_LKR" | "PERCENT",
                  })
                }
              >
                <option value="FIXED_LKR">Fixed LKR amount</option>
                <option value="PERCENT">Percentage</option>
              </select>
            </div>
            <div className="field">
              <label>
                Discount value <span className="field-required-mark">*</span>
              </label>
              <input
                type="number"
                min={form.discountType === "PERCENT" ? 0.01 : 1}
                step={form.discountType === "PERCENT" ? 0.01 : 1}
                max={form.discountType === "PERCENT" ? 100 : undefined}
                value={form.discountValue}
                onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label>Max uses</label>
              <input
                type="number"
                min={1}
                value={form.maxUses}
                onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                placeholder="Unlimited"
              />
            </div>
            <div className="field">
              <label>Min invoice (LKR)</label>
              <input
                type="number"
                min={0}
                value={form.minInvoiceLkr}
                onChange={(e) => setForm({ ...form, minInvoiceLkr: e.target.value })}
                placeholder="Optional"
              />
            </div>
            <div className="field">
              <label>Max discount (LKR)</label>
              <input
                type="number"
                min={0}
                value={form.maxDiscountLkr}
                onChange={(e) => setForm({ ...form, maxDiscountLkr: e.target.value })}
                placeholder="Cap for % vouchers"
              />
            </div>
            <div className="field">
              <label>Valid from</label>
              <input
                type="date"
                value={form.validFrom}
                onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Valid until</label>
              <input
                type="date"
                value={form.validUntil}
                onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
              />
            </div>
          </div>
          <label className="tour-publish-check" style={{ marginTop: 12 }}>
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Active (tourists can redeem)
          </label>
          {status && <p className="field-error-note">{status}</p>}
          <div className="dialog-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : editing ? "Update voucher" : "Create voucher"}
            </button>
          </div>
        </form>
      </DashboardModal>
    </div>
  );
}
