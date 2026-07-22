import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "../../api/client";
import { DashboardModal } from "../DashboardModal";
import type { InvoiceDetail, InvoiceLineItem } from "../../types/billing";

type Props = {
  open: boolean;
  inquiryId: string;
  token: string;
  onClose: () => void;
  onSaved: () => void;
};

type EditableLine = {
  key: string;
  label: string;
  quantity: number;
  unitPriceLkr: number;
};

function toEditable(items: Array<Pick<InvoiceLineItem, "label" | "quantity" | "unitPriceLkr">>): EditableLine[] {
  return items.map((item, idx) => ({
    key: `line-${idx}-${item.label}`,
    label: item.label,
    quantity: item.quantity || 1,
    unitPriceLkr: item.unitPriceLkr || 0,
  }));
}

export function AgencyInvoiceModal({ open, inquiryId, token, onClose, onSaved }: Props) {
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [notes, setNotes] = useState("");
  const [existing, setExisting] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setStatus("");
    api<{
      lineItems: Array<{ label: string; quantity: number; unitPriceLkr: number; amountLkr: number }>;
      existing: InvoiceDetail | null;
    }>(`/invoices/inquiries/${inquiryId}/preview`, { token })
      .then((preview) => {
        setExisting(preview.existing);
        if (preview.existing?.lineItems?.length) {
          setLines(toEditable(preview.existing.lineItems));
          setNotes(preview.existing.notes ?? "");
        } else {
          setLines(toEditable(preview.lineItems));
          setNotes("");
        }
      })
      .catch((err) => {
        setStatus(err instanceof ApiError ? err.message : "Failed to load invoice preview");
      })
      .finally(() => setLoading(false));
  }, [open, inquiryId, token]);

  const subtotal = lines.reduce((sum, li) => sum + li.quantity * li.unitPriceLkr, 0);

  function patchLine(key: string, patch: Partial<EditableLine>) {
    setLines((prev) => prev.map((li) => (li.key === key ? { ...li, ...patch } : li)));
  }

  function addLine() {
    setLines((prev) => [
      ...prev,
      { key: `new-${Date.now()}`, label: "", quantity: 1, unitPriceLkr: 0 },
    ]);
  }

  function removeLine(key: string) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((li) => li.key !== key)));
  }

  async function save(send: boolean) {
    setSaving(true);
    setStatus("");
    try {
      const payload = {
        lineItems: lines
          .filter((li) => li.label.trim())
          .map((li) => ({
            label: li.label.trim(),
            quantity: li.quantity,
            unitPriceLkr: li.unitPriceLkr,
          })),
        notes: notes.trim() || null,
        send,
      };
      if (payload.lineItems.length === 0) {
        setStatus("Add at least one line item with a label.");
        return;
      }
      await api(`/invoices/inquiries/${inquiryId}`, {
        method: "POST",
        token,
        body: JSON.stringify(payload),
      });
      onSaved();
      onClose();
    } catch (err) {
      setStatus(err instanceof ApiError ? err.message : "Failed to save invoice");
    } finally {
      setSaving(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void save(false);
  }

  return (
    <DashboardModal
      open={open}
      title={existing ? `Invoice ${existing.invoiceNumber}` : "Generate invoice"}
      subtitle="Costs are auto-calculated from the proposal — edit any line before sending to the tourist."
      onClose={onClose}
      dialogClassName="tour-dialog"
    >
      {loading ? (
        <p className="muted">Loading pricing…</p>
      ) : (
        <form onSubmit={onSubmit}>
          {existing && (
            <p className="muted" style={{ marginTop: 0 }}>
              Status: <strong>{existing.status}</strong>
              {existing.voucherCode
                ? ` · Voucher ${existing.voucherCode} (−LKR ${existing.voucherDiscountLkr.toLocaleString()})`
                : ""}
            </p>
          )}

          <div className="tour-itinerary-table-wrap">
            <table className="tour-itinerary-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Unit (LKR)</th>
                  <th>Amount</th>
                  <th aria-label="Remove" />
                </tr>
              </thead>
              <tbody>
                {lines.map((li) => (
                  <tr key={li.key}>
                    <td>
                      <input
                        value={li.label}
                        onChange={(e) => patchLine(li.key, { label: e.target.value })}
                        placeholder="Line description"
                        required
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={1}
                        className="tour-itinerary-table__amount"
                        value={li.quantity}
                        onChange={(e) =>
                          patchLine(li.key, { quantity: Math.max(1, Number(e.target.value) || 1) })
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        step={100}
                        className="tour-itinerary-table__amount"
                        value={li.unitPriceLkr || ""}
                        onChange={(e) =>
                          patchLine(li.key, { unitPriceLkr: Number(e.target.value) || 0 })
                        }
                      />
                    </td>
                    <td>LKR {(li.quantity * li.unitPriceLkr).toLocaleString()}</td>
                    <td>
                      <button
                        type="button"
                        className="remove-row-btn"
                        onClick={() => removeLine(li.key)}
                        aria-label="Remove line"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
                <tr className="tour-itinerary-table__total">
                  <td colSpan={3}>
                    <strong>Subtotal</strong>
                  </td>
                  <td colSpan={2}>
                    <strong>LKR {subtotal.toLocaleString()}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <button type="button" className="mini-btn" onClick={addLine} style={{ marginTop: 8 }}>
            + Add line
          </button>

          <div className="field" style={{ marginTop: 12 }}>
            <label>Notes (optional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Payment terms, inclusions, or reminders for the tourist"
            />
          </div>

          {status && <p className="field-error-note">{status}</p>}

          <div className="dialog-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-ghost" disabled={saving || existing?.status === "PAID"}>
              {saving ? "Saving…" : "Save draft"}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={saving || existing?.status === "PAID"}
              onClick={() => void save(true)}
            >
              {saving ? "Sending…" : "Send to tourist"}
            </button>
          </div>
        </form>
      )}
    </DashboardModal>
  );
}
