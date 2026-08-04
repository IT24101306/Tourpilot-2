import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { DashboardModal } from "../DashboardModal";
import type { InvoiceDetail } from "../../types/billing";

type Props = {
  open: boolean;
  inquiryId: string;
  token: string;
  onClose: () => void;
  onUpdated?: () => void;
};

export function TouristInvoiceModal({ open, inquiryId, token, onClose, onUpdated }: Props) {
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [voucherCode, setVoucherCode] = useState("");
  const [status, setStatus] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setStatus("");
    api<InvoiceDetail>(`/invoices/inquiries/${inquiryId}`, { token })
      .then((inv) => {
        setInvoice(inv);
        setVoucherCode(inv.voucherCode ?? "");
      })
      .catch((err) => {
        setStatus(err instanceof ApiError ? err.message : "Failed to load invoice");
        setInvoice(null);
      })
      .finally(() => setLoading(false));
  }, [open, inquiryId, token]);

  async function applyVoucher(e: FormEvent) {
    e.preventDefault();
    if (!invoice) return;
    setWorking(true);
    setStatus("");
    try {
      const updated = await api<InvoiceDetail>(`/invoices/${invoice.id}/redeem-voucher`, {
        method: "POST",
        token,
        body: JSON.stringify({ code: voucherCode }),
      });
      setInvoice(updated);
      setVoucherCode(updated.voucherCode ?? voucherCode);
      onUpdated?.();
    } catch (err) {
      setStatus(err instanceof ApiError ? err.message : "Could not apply voucher");
    } finally {
      setWorking(false);
    }
  }

  async function clearVoucher() {
    if (!invoice) return;
    setWorking(true);
    setStatus("");
    try {
      const updated = await api<InvoiceDetail>(`/invoices/${invoice.id}/redeem-voucher`, {
        method: "POST",
        token,
        body: JSON.stringify({ clear: true }),
      });
      setInvoice(updated);
      setVoucherCode("");
      onUpdated?.();
    } catch (err) {
      setStatus(err instanceof ApiError ? err.message : "Could not remove voucher");
    } finally {
      setWorking(false);
    }
  }

  async function payNow() {
    if (!invoice) return;
    setWorking(true);
    setStatus("");
    try {
      const result = await api<{
        mode: string;
        redirectUrl: string;
        paymentId?: string;
      }>(`/invoices/${invoice.id}/checkout`, {
        method: "POST",
        token,
      });
      onClose();
      if (result.mode === "zero_total") {
        onUpdated?.();
        navigate(result.redirectUrl.replace(/^https?:\/\/[^/]+/, "") || `/trips/${inquiryId}`);
        return;
      }
      navigate(`/checkout/${invoice.id}${result.paymentId ? `?payment=${result.paymentId}` : ""}`);
    } catch (err) {
      setStatus(err instanceof ApiError ? err.message : "Could not start payment");
    } finally {
      setWorking(false);
    }
  }

  return (
    <DashboardModal
      open={open}
      title={invoice ? `Invoice ${invoice.invoiceNumber}` : "Your invoice"}
      subtitle="Review the amount, redeem a voucher if you have one, then pay securely."
      onClose={onClose}
      dialogClassName="tour-dialog"
    >
      {loading ? (
        <p className="muted">Loading invoice…</p>
      ) : !invoice ? (
        <p className="field-error-note">{status || "Invoice not available yet."}</p>
      ) : (
        <div className="invoice-modal">
          {invoice.status === "PAID" && (
            <p className="tour-status">Paid{invoice.paidAt ? ` on ${new Date(invoice.paidAt).toLocaleString()}` : ""}.</p>
          )}

          <div className="tour-itinerary-table-wrap">
            <table className="tour-itinerary-table tour-itinerary-table--summary">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lineItems.map((li) => (
                  <tr key={li.id ?? `${li.label}-${li.sortOrder}`}>
                    <td>{li.label}</td>
                    <td>{li.quantity}</td>
                    <td>LKR {li.amountLkr.toLocaleString()}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={2}>Subtotal</td>
                  <td>LKR {invoice.subtotalLkr.toLocaleString()}</td>
                </tr>
                {invoice.voucherDiscountLkr > 0 && (
                  <tr>
                    <td colSpan={2}>
                      Voucher{invoice.voucherCode ? ` (${invoice.voucherCode})` : ""}
                    </td>
                    <td>− LKR {invoice.voucherDiscountLkr.toLocaleString()}</td>
                  </tr>
                )}
                <tr className="tour-itinerary-table__total">
                  <td colSpan={2}>
                    <strong>Total due</strong>
                  </td>
                  <td>
                    <strong>LKR {invoice.totalLkr.toLocaleString()}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {invoice.notes && (
            <p className="muted" style={{ marginTop: 12 }}>
              {invoice.notes}
            </p>
          )}

          {invoice.status === "SENT" && (
            <>
              <form className="invoice-voucher-row" onSubmit={applyVoucher}>
                <div className="field" style={{ flex: 1, marginBottom: 0 }}>
                  <label>Redeem voucher</label>
                  <input
                    value={voucherCode}
                    onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                    placeholder="e.g. LLT-202607-002"
                    disabled={working}
                  />
                </div>
                <button type="submit" className="btn btn-ghost" disabled={working || !voucherCode.trim()}>
                  Apply
                </button>
                {invoice.voucherCode && (
                  <button type="button" className="btn btn-ghost" disabled={working} onClick={() => void clearVoucher()}>
                    Remove
                  </button>
                )}
              </form>

              {status && <p className="field-error-note">{status}</p>}

              <div className="dialog-actions">
                <button type="button" className="btn btn-ghost" onClick={onClose}>
                  Close
                </button>
                <button type="button" className="btn btn-primary" disabled={working} onClick={() => void payNow()}>
                  {working ? "Please wait…" : "Pay now"}
                </button>
              </div>
            </>
          )}

          {invoice.status === "PAID" && (
            <div className="dialog-actions">
              <button type="button" className="btn btn-primary" onClick={onClose}>
                Done
              </button>
            </div>
          )}
        </div>
      )}
    </DashboardModal>
  );
}
