import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { ModuleHeader } from "../module/ModuleHeader";
import { InquiryThread } from "../inquiry/InquiryThread";
import { InquiryReplyModal } from "../inquiry/InquiryReplyModal";
import type { EntityOption, GroupOption } from "../tour/tourFormTypes";
import type { AgencyEntity, AgencyGroup } from "../../pages/agency/types";
import type { InquiryDetail } from "../../types/negotiation";
import { NegotiationStepper } from "./NegotiationStepper";
import { GuidedStepper } from "../guided/GuidedStepper";
import { GuidedNextBanner } from "../guided/GuidedNextBanner";
import { ProposalCards } from "./ProposalCards";
import { formatInquiryStatus, inquiryStatusClass } from "../../pages/agency/types";

const RESPONDABLE = new Set(["SENT_TO_TOURIST", "TOURIST_VIEWED"]);

type Props = {
  inquiryId: string;
  token: string;
  role: "AGENCY" | "TOURIST";
  backTo: string;
  backLabel?: string;
};

export function TripRoomView({
  inquiryId,
  token,
  role,
  backTo,
  backLabel = "Back",
}: Props) {
  const [inquiry, setInquiry] = useState<InquiryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [replyOpen, setReplyOpen] = useState(false);
  const [entities, setEntities] = useState<EntityOption[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [actionStatus, setActionStatus] = useState("");
  const [acting, setActing] = useState(false);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [revisionNote, setRevisionNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const detail = await api<InquiryDetail>(`/inquiries/${inquiryId}`, { token });
      setInquiry(detail);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load trip room");
    } finally {
      setLoading(false);
    }
  }, [inquiryId, token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (role !== "AGENCY" || !token) return;
    Promise.all([
      api<AgencyEntity[]>("/entities", { token }),
      api<AgencyGroup[]>("/entities/groups", { token }),
    ]).then(([e, g]) => {
      setEntities(
        e.map((row) => ({
          id: row.id,
          name: row.name,
          type: row.type,
          city: row.city,
          priceHint: row.priceHint,
        }))
      );
      setGroups(
        g.map((row) => ({
          id: row.id,
          name: row.name,
          entityIds: row.items.map((item) => item.entity.id),
        }))
      );
    });
  }, [role, token]);

  async function touristRespond(action: "accept" | "revision" | "decline", note?: string) {
    setActing(true);
    setActionStatus("");
    try {
      await api(`/inquiries/${inquiryId}/respond`, {
        method: "POST",
        token,
        body: JSON.stringify({ action, note }),
      });
      setActionStatus(
        action === "accept"
          ? "You accepted the proposal."
          : action === "decline"
            ? "You declined the proposal."
            : "Revision sent — your agency will update the options."
      );
      setRevisionOpen(false);
      setRevisionNote("");
      await load();
    } catch (err) {
      setActionStatus(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setActing(false);
    }
  }

  function onRevisionSubmit(e: FormEvent) {
    e.preventDefault();
    if (!revisionNote.trim()) return;
    touristRespond("revision", revisionNote.trim());
  }

  const shellClass =
    role === "TOURIST"
      ? "section trip-room-page module-shell module-guided module-negotiation"
      : "section trip-room-page module-shell module-negotiation";

  if (loading) {
    return (
      <section className={shellClass}>
        <p className="muted">Opening trip room…</p>
      </section>
    );
  }

  if (error || !inquiry) {
    return (
      <section className={shellClass}>
        <p className="form-error">{error || "Trip not found"}</p>
        <Link to={backTo} className="btn btn-ghost">
          {backLabel}
        </Link>
      </section>
    );
  }

  const counterparty =
    role === "AGENCY"
      ? inquiry.tourist?.name ?? "Traveler"
      : inquiry.agency?.name ?? "Agency";
  const agencySlug = inquiry.agency?.slug;
  const canRespond = role === "TOURIST" && RESPONDABLE.has(inquiry.status) && inquiry.proposal;

  return (
    <section className={shellClass}>
      <ModuleHeader
        module={role === "TOURIST" ? "guided" : "negotiation"}
        title={
          role === "TOURIST" ? `Your trip with ${counterparty}` : `Trip room · ${counterparty}`
        }
        subtitle={
          role === "TOURIST"
            ? "Follow each step — chat, compare options, and confirm when you are ready."
            : "Plan together — clarify details, compare options, and confirm the trip."
        }
      >
        <Link to={backTo} className="btn btn-ghost">
          {backLabel}
        </Link>
        {role === "AGENCY" && (
          <button type="button" className="btn btn-primary" onClick={() => setReplyOpen(true)}>
            {inquiry.proposal ? "Update proposal" : "Send proposal"}
          </button>
        )}
      </ModuleHeader>

      <div className="trip-room-surface">
        {role === "TOURIST" ? (
          <>
            <GuidedNextBanner status={inquiry.status} hasProposal={!!inquiry.proposal} />
            <GuidedStepper status={inquiry.status} />
          </>
        ) : (
          <NegotiationStepper status={inquiry.status} />
        )}

        <div className="neg-trip-meta">
          <span className={`agency-status ${inquiryStatusClass(inquiry.status)}`}>
            {formatInquiryStatus(inquiry.status)}
          </span>
          <span className="muted">
            {inquiry.pax} traveler{inquiry.pax === 1 ? "" : "s"}
            {inquiry.tour?.title ? ` · ${inquiry.tour.title}` : " · Custom trip"}
          </span>
        </div>

        {actionStatus && <p className="neg-action-status">{actionStatus}</p>}

        <div className="neg-trip-room-grid">
        <section className="neg-panel neg-panel--chat">
          <h3 className="neg-panel-title">Conversation</h3>
          <p className="neg-panel-hint">Ask questions and refine the plan together.</p>

          {(inquiry.startDate || inquiry.budgetBand) && (
            <div className="neg-request-meta">
              {inquiry.startDate && (
                <p className="muted">
                  Dates: {new Date(inquiry.startDate).toLocaleDateString()}
                  {inquiry.endDate
                    ? ` – ${new Date(inquiry.endDate).toLocaleDateString()}`
                    : ""}
                </p>
              )}
              {inquiry.budgetBand && <p className="muted">Budget: {inquiry.budgetBand}</p>}
            </div>
          )}

          {inquiry.thread && inquiry.thread.length > 0 ? (
            <InquiryThread messages={inquiry.thread} hideTitle />
          ) : (
            <p className="muted neg-chat-empty">
              {role === "AGENCY"
                ? "Send a proposal to start the conversation."
                : "Your agency will reply here soon."}
            </p>
          )}
        </section>

        <section className="neg-panel neg-panel--proposal">
          <h3 className="neg-panel-title">Proposal options</h3>
          <p className="neg-panel-hint">
            {inquiry.proposal
              ? "Compare options and choose what fits best."
              : "Options will appear here when your agency sends a proposal."}
          </p>

          {inquiry.proposal?.message && (
            <blockquote className="neg-proposal-message">
              <span className="neg-proposal-message-label">Latest proposal note</span>
              {inquiry.proposal.message}
            </blockquote>
          )}

          <ProposalCards
            items={inquiry.proposal?.items ?? []}
            agencySlug={agencySlug}
            compare={(inquiry.proposal?.items.length ?? 0) > 1}
          />

          {canRespond && (
            <div className="neg-decision-bar">
              <p className="neg-decision-lead">Ready to decide?</p>
              <div className="neg-decision-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={acting}
                  onClick={() => touristRespond("accept")}
                >
                  Accept proposal
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={acting}
                  onClick={() => setRevisionOpen((v) => !v)}
                >
                  Request changes
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={acting}
                  onClick={() => touristRespond("decline")}
                >
                  Decline
                </button>
              </div>
              {revisionOpen && (
                <form className="neg-revision-form" onSubmit={onRevisionSubmit}>
                  <label htmlFor="revisionNote">What would you like changed?</label>
                  <textarea
                    id="revisionNote"
                    rows={3}
                    value={revisionNote}
                    onChange={(e) => setRevisionNote(e.target.value)}
                    placeholder="e.g. Prefer fewer travel days, add a beach stay…"
                    required
                  />
                  <button type="submit" className="btn btn-teal" disabled={acting}>
                    Send revision request
                  </button>
                </form>
              )}
            </div>
          )}
        </section>
        </div>
      </div>

      {role === "AGENCY" && (
        <InquiryReplyModal
          open={replyOpen}
          token={token}
          inquiryId={inquiryId}
          entities={entities}
          groups={groups}
          onClose={() => setReplyOpen(false)}
          onSent={() => {
            setReplyOpen(false);
            load();
          }}
        />
      )}
    </section>
  );
}
