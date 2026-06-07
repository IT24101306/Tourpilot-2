import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useConfirmAction } from "../confirm/ConfirmActionContext";
import { ModuleHeader } from "../module/ModuleHeader";
import { InquiryThread } from "../inquiry/InquiryThread";
import { InquiryTourChip } from "../inquiry/InquiryTourChip";
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

type TripRoomRole = "AGENCY" | "TOURIST" | "ADMIN";

type Props = {
  inquiryId: string;
  token: string;
  role: TripRoomRole;
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
  const { user } = useAuth();
  const { requestConfirm } = useConfirmAction();
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
  const [adminMessage, setAdminMessage] = useState("");
  const [adminSending, setAdminSending] = useState(false);

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

  function sendAdminMessage(e: FormEvent) {
    e.preventDefault();
    const text = adminMessage.trim();
    if (!text) return;
    requestConfirm({
      title: "Send platform message?",
      description: "Visible to both the tourist and agency in this trip room.",
      confirmLabel: "Send message",
      summary: [
        { label: "Trip", value: inquiry?.tour?.title ?? inquiry?.type ?? "Custom trip" },
        { label: "Tourist", value: inquiry?.tourist?.name ?? "—" },
        { label: "Agency", value: inquiry?.agency?.name ?? "—" },
        {
          label: "Message",
          value: text.length > 160 ? `${text.slice(0, 160)}…` : text,
        },
      ],
      onConfirm: async () => {
        setAdminSending(true);
        setActionStatus("");
        try {
          await api(`/admin/inquiries/${inquiryId}/messages`, {
            method: "POST",
            token,
            body: JSON.stringify({ message: text }),
          });
          setAdminMessage("");
          setActionStatus("Platform message sent.");
          await load();
        } catch (err) {
          setActionStatus(err instanceof ApiError ? err.message : "Failed to send message");
        } finally {
          setAdminSending(false);
        }
      },
    });
  }

  const shellClass =
    role === "TOURIST"
      ? "section trip-room-page module-shell module-guided module-negotiation"
      : role === "ADMIN"
        ? "section trip-room-page module-shell module-governance module-negotiation"
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
      : role === "ADMIN"
        ? `${inquiry.tourist?.name ?? "Traveler"} · ${inquiry.agency?.name ?? "Agency"}`
        : inquiry.agency?.name ?? "Agency";
  const agencySlug = inquiry.agency?.slug ?? user?.agency?.slug;
  const canRespond = role === "TOURIST" && RESPONDABLE.has(inquiry.status) && inquiry.proposal;

  return (
    <section className={shellClass}>
      <ModuleHeader
        module={role === "TOURIST" ? "guided" : role === "ADMIN" ? "governance" : "negotiation"}
        title={
          role === "TOURIST"
            ? `Your trip with ${counterparty}`
            : role === "ADMIN"
              ? `Admin trip room · ${counterparty}`
              : `Trip room · ${counterparty}`
        }
        subtitle={
          role === "TOURIST"
            ? "Follow each step — chat, compare options, and confirm when you are ready."
            : role === "ADMIN"
              ? "Review the negotiation and post platform messages visible to both parties."
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
        ) : role === "ADMIN" ? (
          <NegotiationStepper status={inquiry.status} />
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
            {role === "AGENCY" && inquiry.tourist?.phone && (
              <> · {inquiry.tourist.phone}</>
            )}
            {role === "AGENCY" && inquiry.tourist?.email && (
              <> · {inquiry.tourist.email}</>
            )}
            {role === "ADMIN" && inquiry.tourist?.phone && (
              <> · Tourist: {inquiry.tourist.phone}</>
            )}
            {role === "ADMIN" && inquiry.tourist?.email && (
              <> · {inquiry.tourist.email}</>
            )}
          </span>
        </div>

        {actionStatus && <p className="neg-action-status">{actionStatus}</p>}

        <div className="neg-trip-room-grid">
        <section className="neg-panel neg-panel--chat">
          <h3 className="neg-panel-title">Conversation</h3>
          <p className="neg-panel-hint">Ask questions and refine the plan together.</p>

          {inquiry.tour && agencySlug && (
            <InquiryTourChip
              tour={{
                id: inquiry.tour.id,
                title: inquiry.tour.title,
                slug: inquiry.tour.slug,
                days: inquiry.tour.days ?? 0,
                basePriceLkr: inquiry.tour.basePriceLkr,
              }}
              agencySlug={agencySlug}
              compact
            />
          )}

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
                : role === "ADMIN"
                  ? "No messages yet."
                  : "Your agency will reply here soon."}
            </p>
          )}

          {role === "ADMIN" && (
            <form className="neg-admin-compose" onSubmit={sendAdminMessage}>
              <label htmlFor="adminTripMessage">Message as platform admin</label>
              <p className="muted neg-panel-hint">
                Shown to the tourist and agency with a distinct platform style.
              </p>
              <textarea
                id="adminTripMessage"
                rows={3}
                value={adminMessage}
                onChange={(e) => setAdminMessage(e.target.value)}
                placeholder="e.g. We are mediating this inquiry — please respond within 48 hours."
                required
              />
              <button type="submit" className="btn btn-primary" disabled={adminSending}>
                {adminSending ? "Sending…" : "Send platform message"}
              </button>
            </form>
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
