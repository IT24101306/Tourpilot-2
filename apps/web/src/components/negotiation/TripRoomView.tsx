import { FormEvent, useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useChatExitGuard } from "../../context/ChatSessionContext";
import { useConfirmAction } from "../confirm/ConfirmActionContext";
import { ModuleHeader } from "../module/ModuleHeader";
import { InquiryThread, TypingIndicator } from "../inquiry/InquiryThread";
import { InquiryTourChip } from "../inquiry/InquiryTourChip";
import { InquiryReplyModal } from "../inquiry/InquiryReplyModal";
import type { EntityOption, GroupOption } from "../tour/tourFormTypes";
import type { AgencyEntity, AgencyGroup } from "../../pages/agency/types";
import type { InquiryDetail } from "../../types/negotiation";
import type { ThreadMessage } from "../inquiry/InquiryThread";
import { NegotiationStepper } from "./NegotiationStepper";
import { GuidedStepper } from "../guided/GuidedStepper";
import { GuidedNextBanner } from "../guided/GuidedNextBanner";
import { ProposalCards } from "./ProposalCards";
import { formatInquiryStatus, inquiryStatusClass } from "../../pages/agency/types";
import { AgencyInvoiceModal } from "../billing/AgencyInvoiceModal";
import { TouristInvoiceModal } from "../billing/TouristInvoiceModal";
import { useChatLive } from "../../lib/useChatLive";

const RESPONDABLE = new Set(["SENT_TO_TOURIST", "TOURIST_VIEWED"]);

type TripRoomRole = "AGENCY" | "TOURIST" | "ADMIN" | "INFLUENCER";

type Props = {
  inquiryId: string;
  token: string;
  role: TripRoomRole;
  backTo: string;
  backLabel?: string;
  /** Render inside a drawer/panel without leaving the parent page. */
  embedded?: boolean;
  onClose?: () => void;
  /** Lets a parent (drawer backdrop / Escape) trigger the same exit confirm. */
  exitHandlerRef?: MutableRefObject<(() => void) | null>;
};

export function TripRoomView({
  inquiryId,
  token,
  role,
  backTo,
  backLabel = "Back",
  embedded = false,
  onClose,
  exitHandlerRef,
}: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
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
  const [chatMessage, setChatMessage] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [actionsDocked, setActionsDocked] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewBody, setReviewBody] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const autoOpenedInvoiceRef = useRef<string | null>(null);
  const actionsBarRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(
    async (opts?: { quiet?: boolean }) => {
      if (!opts?.quiet) {
        setLoading(true);
        setError("");
      }
      try {
        const detail = await api<InquiryDetail>(`/inquiries/${inquiryId}`, { token });
        setInquiry(detail);
      } catch (err) {
        if (!opts?.quiet) {
          setError(err instanceof ApiError ? err.message : "Failed to load trip room");
        }
      } finally {
        if (!opts?.quiet) setLoading(false);
      }
    },
    [inquiryId, token]
  );

  useEffect(() => {
    load();
  }, [load]);

  const { typing, onComposeChange, stopTyping } = useChatLive({
    inquiryId,
    token,
    enabled: Boolean(inquiryId && token && !loading && inquiry),
    onThread: (thread: ThreadMessage[]) => {
      setInquiry((prev) => (prev ? { ...prev, thread } : prev));
    },
  });

  const partnerForExit =
    role === "AGENCY"
      ? inquiry?.tourist?.name
      : role === "ADMIN"
        ? undefined
        : role === "INFLUENCER"
          ? inquiry?.tourist?.name
          : inquiry?.whiteLabel && inquiry.handlerInfluencer?.name
            ? inquiry.handlerInfluencer.name
            : inquiry?.agency?.name;

  const { requestExit } = useChatExitGuard({
    active: Boolean(inquiryId && token),
    inquiryId,
    partnerLabel: partnerForExit ?? "this chat",
    exitHandlerRef,
    onLeave: () => {
      if (embedded && onClose) {
        onClose();
        return;
      }
      navigate(backTo);
    },
  });

  // When an invoice is newly sent, open it for the tourist automatically (once).
  useEffect(() => {
    if (role !== "TOURIST") return;
    const inv = inquiry?.invoice;
    if (inv?.status === "SENT" && autoOpenedInvoiceRef.current !== inv.id) {
      autoOpenedInvoiceRef.current = inv.id;
      setInvoiceModalOpen(true);
    }
  }, [role, inquiry?.invoice?.id, inquiry?.invoice?.status]);

  // Keep the action bar floating, but dock it above the site footer when that enters view.
  useEffect(() => {
    if (embedded) return;
    const footer = document.querySelector(".site-footer");
    if (!footer) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setActionsDocked(entry.isIntersecting);
      },
      {
        root: null,
        threshold: 0,
        // Start docking slightly before the footer reaches the bar.
        rootMargin: "0px 0px 96px 0px",
      }
    );
    observer.observe(footer);
    return () => observer.disconnect();
  }, [embedded, loading, inquiry?.id]);

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

  async function lifecycleTransition(action: "start" | "complete") {
    setActing(true);
    setActionStatus("");
    try {
      await api(`/inquiries/${inquiryId}/lifecycle`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ action }),
      });
      setActionStatus(action === "start" ? "Trip started." : "Trip completed.");
      await load();
    } catch (err) {
      setActionStatus(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setActing(false);
    }
  }

  async function submitReview() {
    if (reviewRating < 1 || reviewRating > 5) return;
    setReviewSubmitting(true);
    try {
      await api(`/reviews/trip/${inquiryId}`, {
        method: "POST",
        token,
        body: JSON.stringify({ rating: reviewRating, body: reviewBody.trim() || undefined }),
      });
      setReviewSubmitted(true);
    } catch (err) {
      setActionStatus(err instanceof ApiError ? err.message : "Failed to submit review");
    } finally {
      setReviewSubmitting(false);
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

  function sendChatMessage(e: FormEvent) {
    e.preventDefault();
    const text = chatMessage.trim();
    if (!text) return;
    void (async () => {
      setChatSending(true);
      setActionStatus("");
      stopTyping();
      try {
        await api(`/inquiries/${inquiryId}/messages`, {
          method: "POST",
          token,
          body: JSON.stringify({ message: text }),
        });
        setChatMessage("");
        await load({ quiet: true });
      } catch (err) {
        setActionStatus(err instanceof ApiError ? err.message : "Failed to send message");
      } finally {
        setChatSending(false);
      }
    })();
  }

  const shellClass = embedded
    ? "trip-room-embedded"
    : role === "TOURIST"
      ? "section trip-room-page module-shell module-guided module-negotiation"
      : role === "ADMIN"
        ? "section trip-room-page module-shell module-governance module-negotiation"
        : role === "INFLUENCER"
          ? "section trip-room-page module-shell module-partner module-negotiation"
          : "section trip-room-page module-shell module-negotiation";

  if (loading) {
    return (
      <section className={shellClass}>
        {embedded && onClose ? (
          <header className="trip-room-embedded__bar">
            <p className="muted" style={{ margin: 0 }}>
              Opening trip room…
            </p>
            <button type="button" className="btn btn-ghost" onClick={requestExit}>
              Close
            </button>
          </header>
        ) : null}
        <p className="muted">Opening trip room…</p>
      </section>
    );
  }

  if (error || !inquiry) {
    return (
      <section className={shellClass}>
        <p className="form-error">{error || "Trip not found"}</p>
        {embedded && onClose ? (
          <button type="button" className="btn btn-ghost" onClick={requestExit}>
            Close
          </button>
        ) : (
          <button type="button" className="btn btn-ghost" onClick={requestExit}>
            {backLabel}
          </button>
        )}
      </section>
    );
  }

  const whiteLabel = Boolean(inquiry.whiteLabel && inquiry.handlerInfluencer);
  const counterparty =
    role === "AGENCY"
      ? inquiry.tourist?.name ?? "Traveler"
      : role === "ADMIN"
        ? `${inquiry.tourist?.name ?? "Traveler"} · ${inquiry.agency?.name ?? "Agency"}`
        : role === "INFLUENCER"
          ? inquiry.tourist?.name ?? "Traveler"
          : whiteLabel
            ? inquiry.handlerInfluencer?.name ?? "Partner"
            : inquiry.agency?.name ?? "Agency";
  const agencySlug = inquiry.agency?.slug ?? user?.agency?.slug;
  const bookingsEnabled = inquiry.agency?.features?.negotiationsBookings !== false;
  const canRespond =
    role === "TOURIST" &&
    RESPONDABLE.has(inquiry.status) &&
    Boolean(inquiry.proposal) &&
    bookingsEnabled;
  const canRequestChanges =
    role === "TOURIST" && RESPONDABLE.has(inquiry.status) && Boolean(inquiry.proposal);
  const canChat = role === "TOURIST" || role === "AGENCY" || role === "INFLUENCER";

  return (
    <section className={shellClass}>
      {embedded ? (
        <header className="trip-room-embedded__bar">
          <div className="trip-room-embedded__titles">
            <p className="trip-room-embedded__eyebrow">Trip room</p>
            <h2>
              {role === "TOURIST" ? `Your trip with ${counterparty}` : `Trip room · ${counterparty}`}
            </h2>
          </div>
        </header>
      ) : (
        <ModuleHeader
          module={
            role === "TOURIST"
              ? "guided"
              : role === "ADMIN"
                ? "governance"
                : role === "INFLUENCER"
                  ? "partner"
                  : "negotiation"
          }
          title={
            role === "TOURIST"
              ? `Your trip with ${counterparty}`
              : role === "ADMIN"
                ? `Admin trip room · ${counterparty}`
                : role === "INFLUENCER"
                  ? `Chat · ${counterparty}`
                  : `Trip room · ${counterparty}`
          }
          subtitle={
            role === "TOURIST"
              ? whiteLabel
                ? "Chat with your partner — refine details and confirm when you are ready."
                : "Follow each step — chat, compare options, and confirm when you are ready."
              : role === "ADMIN"
                ? "Review the negotiation and post platform messages visible to both parties."
                : role === "INFLUENCER"
                  ? "Reply to travelers who inquired from your shared tours."
                  : "Plan together — clarify details, compare options, and confirm the trip."
          }
        />
      )}

      <div className="trip-room-surface">
        {role === "TOURIST" ? (
          <>
            <GuidedNextBanner
              status={inquiry.status}
              hasProposal={!!inquiry.proposal}
              partnerName={
                inquiry.whiteLabel && inquiry.handlerInfluencer?.name
                  ? inquiry.handlerInfluencer.name
                  : inquiry.agency?.name
              }
            />
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

        {role === "TOURIST" &&
          !bookingsEnabled &&
          RESPONDABLE.has(inquiry.status) &&
          Boolean(inquiry.proposal) && (
            <div className="feature-unavailable-note" role="status">
              <strong>Online booking paused</strong>
              <p>
                This agency is not accepting online confirmations right now. You can still
                request changes or decline the proposal.
              </p>
            </div>
          )}

        {role === "TOURIST" && inquiry.status === "COMPLETED" && !reviewSubmitted && (
          <div className="neg-review-prompt" role="region" aria-label="Leave a review">
            <h3>How was your trip?</h3>
            <p className="muted">Your review helps other travelers and the agency.</p>
            <div className="neg-review-stars" role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className={`neg-review-star${reviewRating >= star ? " is-active" : ""}`}
                  onClick={() => setReviewRating(star)}
                  aria-label={`${star} star${star === 1 ? "" : "s"}`}
                >
                  ★
                </button>
              ))}
            </div>
            <textarea
              className="neg-review-body"
              placeholder="Tell us about your experience (optional)"
              value={reviewBody}
              onChange={(e) => setReviewBody(e.target.value)}
              maxLength={2000}
              rows={3}
            />
            <button
              type="button"
              className="btn btn-primary"
              disabled={reviewRating === 0 || reviewSubmitting}
              onClick={submitReview}
            >
              {reviewSubmitting ? "Submitting…" : "Submit review"}
            </button>
          </div>
        )}
        {role === "TOURIST" && reviewSubmitted && (
          <div className="neg-review-prompt neg-review-prompt--done">
            <h3>Thank you for your review!</h3>
            <p className="muted">
              Your feedback is pending agency approval before appearing publicly.
            </p>
          </div>
        )}

        <div className="neg-trip-room-grid">
        <section className="neg-panel neg-panel--chat">
          <h3 className="neg-panel-title">Conversation</h3>
          <p className="neg-panel-hint">Ask questions and refine the plan together.</p>

          {inquiry.tour && agencySlug && !whiteLabel && (
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
          {inquiry.tour && whiteLabel && (
            <p className="muted neg-request-meta">
              Tour: <strong>{inquiry.tour.title}</strong>
            </p>
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
            <InquiryThread messages={inquiry.thread} hideTitle currentUserId={user?.id} />
          ) : (
            <p className="muted neg-chat-empty">
              {role === "AGENCY"
                ? "Message the traveler below to start the conversation — or send a proposal when ready."
                : role === "ADMIN"
                  ? "No messages yet."
                  : role === "INFLUENCER"
                    ? "Reply below to start chatting with this traveler."
                    : whiteLabel
                      ? "Your partner will reply here soon."
                      : "Your agency will reply here soon."}
            </p>
          )}

          <TypingIndicator names={typing.map((t) => t.name)} />

          {canChat && (
            <form className="neg-admin-compose" onSubmit={sendChatMessage}>
              <label htmlFor="tripChatMessage">
                {role === "INFLUENCER" ? "Message traveler" : "Send a message"}
              </label>
              <textarea
                id="tripChatMessage"
                rows={3}
                value={chatMessage}
                onChange={(e) => {
                  setChatMessage(e.target.value);
                  onComposeChange(e.target.value);
                }}
                placeholder={
                  role === "INFLUENCER"
                    ? "Answer questions, share details, or suggest next steps…"
                    : "Write a message…"
                }
                required
              />
              <button type="submit" className="btn btn-primary" disabled={chatSending}>
                {chatSending ? "Sending…" : "Send message"}
              </button>
            </form>
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
            partnerName={
              inquiry.whiteLabel && inquiry.handlerInfluencer?.name
                ? inquiry.handlerInfluencer.name
                : inquiry.agency?.name
            }
          />
        </section>
        </div>
      </div>

      <div
        ref={actionsBarRef}
        className={`trip-room-actions trip-room-actions--float${
          actionsDocked ? " is-docked" : ""
        }`}
        aria-label="Trip room actions"
      >
        {embedded && onClose ? (
          <button type="button" className="btn btn-ghost" onClick={requestExit}>
            Back to list
          </button>
        ) : (
          <button type="button" className="btn btn-ghost" onClick={requestExit}>
            {backLabel}
          </button>
        )}
        {role === "AGENCY" && (
          <button type="button" className="btn btn-primary" onClick={() => setReplyOpen(true)}>
            {inquiry.proposal ? "Update proposal" : "Send proposal"}
          </button>
        )}
        {role === "AGENCY" && (inquiry.status === "ACCEPTED" || inquiry.status === "IN_PROGRESS") && (
          <button type="button" className="btn btn-teal" onClick={() => setInvoiceModalOpen(true)}>
            {inquiry.invoice ? "Edit / send invoice" : "Generate invoice"}
          </button>
        )}
        {role === "AGENCY" && inquiry.status === "ACCEPTED" && (
          <button
            type="button"
            className="btn btn-primary"
            disabled={acting}
            onClick={() => lifecycleTransition("start")}
          >
            Start trip
          </button>
        )}
        {role === "AGENCY" && inquiry.status === "IN_PROGRESS" && (
          <button
            type="button"
            className="btn btn-primary"
            disabled={acting}
            onClick={() => lifecycleTransition("complete")}
          >
            Complete trip
          </button>
        )}
        {role === "TOURIST" &&
          inquiry.invoice &&
          (inquiry.invoice.status === "SENT" || inquiry.invoice.status === "PAID") && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setInvoiceModalOpen(true)}
            >
              {inquiry.invoice.status === "PAID" ? "View paid invoice" : "View invoice & pay"}
            </button>
          )}
        {canRespond && (
          <button
            type="button"
            className="btn btn-primary"
            disabled={acting}
            onClick={() => touristRespond("accept")}
          >
            Accept proposal
          </button>
        )}
        {canRequestChanges && (
          <button
            type="button"
            className="btn btn-ghost"
            disabled={acting}
            onClick={() => setRevisionOpen((v) => !v)}
          >
            Request changes
          </button>
        )}
        {canRequestChanges && (
          <button
            type="button"
            className="btn btn-ghost"
            disabled={acting}
            onClick={() => touristRespond("decline")}
          >
            Decline
          </button>
        )}
      </div>

      {revisionOpen && (
        <form className="neg-revision-form trip-room-revision-float" onSubmit={onRevisionSubmit}>
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

      {role === "AGENCY" && (
        <AgencyInvoiceModal
          open={invoiceModalOpen}
          inquiryId={inquiryId}
          token={token}
          onClose={() => setInvoiceModalOpen(false)}
          onSaved={() => {
            setInvoiceModalOpen(false);
            load();
          }}
        />
      )}

      {role === "TOURIST" && (
        <TouristInvoiceModal
          open={invoiceModalOpen}
          inquiryId={inquiryId}
          token={token}
          onClose={() => setInvoiceModalOpen(false)}
          onUpdated={() => load()}
        />
      )}
    </section>
  );
}
