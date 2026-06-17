import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "../../api/client";
import {
  commissionStatusLabel,
  isCommissionNegotiationOpen,
  type CommissionNegotiation,
} from "../../lib/commissionNegotiationTypes";

type Props = {
  row: CommissionNegotiation;
  viewerRole: "AGENCY" | "INFLUENCER";
  token: string;
  onUpdated: (row: CommissionNegotiation) => void;
  compact?: boolean;
};

export function CommissionNegotiationPanel({
  row,
  viewerRole,
  token,
  onUpdated,
  compact = false,
}: Props) {
  const [message, setMessage] = useState("");
  const [proposedPct, setProposedPct] = useState(String(row.currentOfferPct));
  const [showNegotiate, setShowNegotiate] = useState(false);
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setProposedPct(String(row.currentOfferPct));
  }, [row.id, row.currentOfferPct]);

  const open = isCommissionNegotiationOpen(row);
  const myTurn = open && row.pendingActor === viewerRole;
  const counterparty =
    viewerRole === "AGENCY" ? row.influencer.name : row.agency.name;

  async function sendAction(action: "AGREE" | "REJECT" | "NEGOTIATE", e?: FormEvent) {
    e?.preventDefault();
    if (!token || submitting) return;
    setSubmitting(true);
    setStatus("");
    try {
      const path =
        viewerRole === "AGENCY"
          ? `/agencies/mine/influencer-commission-requests/${row.id}`
          : `/influencer/commission-requests/${row.id}`;

      const body: Record<string, unknown> = { action };
      if (action === "NEGOTIATE") {
        body.proposedPct = Number(proposedPct);
        body.message = message.trim() || undefined;
      } else if (message.trim()) {
        body.message = message.trim();
      }

      const updated = await api<CommissionNegotiation>(path, {
        method: "PATCH",
        token,
        body: JSON.stringify(body),
      });
      onUpdated(updated);
      setMessage("");
      setShowNegotiate(false);
      setStatus(
        action === "AGREE"
          ? "Agreement recorded."
          : action === "REJECT"
            ? "Negotiation closed."
            : "Counter-offer sent."
      );
    } catch (err) {
      setStatus(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <article className={`commission-negotiation${compact ? " commission-negotiation--compact" : ""}`}>
      <header className="commission-negotiation__head">
        <div>
          <strong>{row.tour.title}</strong>
          <p className="muted">
            {viewerRole === "AGENCY" ? row.influencer.name : row.agency.name}
            {" · "}
            {commissionStatusLabel(row.status)}
            {open ? ` · current offer ${row.currentOfferPct}%` : ""}
          </p>
        </div>
        {!compact && (
          <span className={`commission-negotiation__badge commission-negotiation__badge--${row.status.toLowerCase()}`}>
            {row.status}
          </span>
        )}
      </header>

      <ul className="commission-negotiation__thread" aria-label="Negotiation messages">
        {row.messages.map((m) => (
          <li
            key={m.id}
            className={`commission-negotiation__msg commission-negotiation__msg--${m.authorRole.toLowerCase()}`}
          >
            <div className="commission-negotiation__msg-meta">
              <strong>{m.authorRole === "AGENCY" ? "Agency" : "Influencer"}</strong>
              <span className="muted">
                {m.action === "REQUEST"
                  ? "opened request"
                  : m.action === "NEGOTIATE"
                    ? `proposed ${m.proposedPct}%`
                    : m.action === "AGREE"
                      ? "agreed"
                      : "declined"}
                {" · "}
                {new Date(m.createdAt).toLocaleString()}
              </span>
            </div>
            <p>{m.body}</p>
          </li>
        ))}
      </ul>

      {open && (
        <div className="commission-negotiation__actions">
          {myTurn ? (
            <>
              <p className="commission-negotiation__turn muted">Your turn — respond to {counterparty}.</p>
              <label className="field full">
                <span>Message (optional)</span>
                <textarea
                  rows={2}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Add context for your response…"
                />
              </label>
              <div className="commission-negotiation__btns">
                <button
                  type="button"
                  className="brand-btn brand-btn--primary"
                  disabled={submitting}
                  onClick={() => void sendAction("AGREE")}
                >
                  Agree
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={submitting}
                  onClick={() => void sendAction("REJECT")}
                >
                  Reject
                </button>
                <button
                  type="button"
                  className="brand-btn brand-btn--secondary"
                  disabled={submitting}
                  onClick={() => setShowNegotiate((v) => !v)}
                >
                  Negotiate
                </button>
              </div>
              {showNegotiate && (
                <form className="commission-negotiation__counter" onSubmit={(e) => void sendAction("NEGOTIATE", e)}>
                  <label className="field">
                    <span>Your counter-offer %</span>
                    <input
                      type="number"
                      min={0}
                      max={50}
                      step={0.5}
                      required
                      value={proposedPct}
                      onChange={(e) => setProposedPct(e.target.value)}
                    />
                  </label>
                  <button type="submit" className="btn btn-teal" disabled={submitting}>
                    Send counter-offer
                  </button>
                </form>
              )}
            </>
          ) : (
            <p className="muted">Waiting for {counterparty} to respond.</p>
          )}
        </div>
      )}

      {!open && (
        <p className="muted commission-negotiation__closed">
          {row.status === "APPROVED"
            ? `Final rate: ${row.approvedPct ?? row.currentOfferPct}%`
            : "This negotiation was closed."}
        </p>
      )}

      {status ? <p className="commission-negotiation__status">{status}</p> : null}
    </article>
  );
}
