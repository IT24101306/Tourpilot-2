import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { createPortal } from "react-dom";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useChatExitGuard } from "../../context/ChatSessionContext";
import { lockBodyScroll, unlockBodyScroll } from "../../lib/scrollLock";
import type { InquiryDetail } from "../../types/negotiation";
import { InquiryThread, TypingIndicator } from "./InquiryThread";
import { useChatLive } from "../../lib/useChatLive";
import type { ThreadMessage } from "./InquiryThread";

type Props = {
  open: boolean;
  inquiryId: string | null;
  partnerName?: string | null;
  /** Override "Open full trip room" link (agency uses trip-room path). */
  fullRoomTo?: string;
  /** Empty-state copy when there are no messages yet. */
  emptyHint?: string;
  onClose: () => void;
};

export function ChatRoomPopup({
  open,
  inquiryId,
  partnerName,
  fullRoomTo,
  emptyHint,
  onClose,
}: Props) {
  const { token, user } = useAuth();
  const listRef = useRef<HTMLDivElement>(null);
  const [inquiry, setInquiry] = useState<InquiryDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const isAgencyViewer = user?.role === "AGENCY";
  const partner =
    partnerName?.trim() ||
    (isAgencyViewer
      ? inquiry?.tourist?.name
      : inquiry?.whiteLabel && inquiry.handlerInfluencer?.name
        ? inquiry.handlerInfluencer.name
        : inquiry?.agency?.name) ||
    (isAgencyViewer ? "traveler" : "your travel partner");

  const { requestExit, leaveWithoutConfirm } = useChatExitGuard({
    active: Boolean(open && inquiryId),
    inquiryId,
    partnerLabel: partner,
    onLeave: onClose,
  });

  const load = useCallback(
    async (opts?: { quiet?: boolean }) => {
      if (!token || !inquiryId) return;
      if (!opts?.quiet) {
        setLoading(true);
        setError("");
      }
      try {
        const detail = await api<InquiryDetail>(`/inquiries/${inquiryId}`, { token });
        setInquiry(detail);
      } catch (err) {
        if (!opts?.quiet) {
          setError(err instanceof ApiError ? err.message : "Could not load chat room");
        }
      } finally {
        if (!opts?.quiet) setLoading(false);
      }
    },
    [token, inquiryId]
  );

  useEffect(() => {
    if (!open || !inquiryId) {
      setInquiry(null);
      setDraft("");
      setError("");
      return;
    }
    void load();
  }, [open, inquiryId, load]);

  const { typing, onComposeChange, stopTyping } = useChatLive({
    inquiryId: inquiryId ?? "",
    token: token ?? "",
    viewerUserId: user?.id,
    enabled: Boolean(open && inquiryId && token && inquiry),
    onThread: (thread: ThreadMessage[]) => {
      setInquiry((prev) => (prev ? { ...prev, thread } : prev));
    },
  });

  useEffect(() => {
    if (!open) return;
    lockBodyScroll();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") requestExit();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      unlockBodyScroll();
      window.removeEventListener("keydown", onKey);
    };
  }, [open, requestExit]);

  useEffect(() => {
    if (!open || !inquiry?.thread?.length) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [open, inquiry?.thread, typing]);

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !token || !inquiryId) return;
    setSending(true);
    setError("");
    stopTyping();
    try {
      await api(`/inquiries/${inquiryId}/messages`, {
        method: "POST",
        token,
        body: JSON.stringify({ message: text }),
      });
      setDraft("");
      await load({ quiet: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  if (!open || !inquiryId) return null;

  const roomLink = fullRoomTo ?? (isAgencyViewer ? `/dashboard/agency/trip-room/${inquiryId}` : `/trips?room=${inquiryId}`);

  return createPortal(
    <div className="chat-room-popup" role="presentation" onClick={requestExit}>
      <aside
        className="chat-room-popup__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-room-popup-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="chat-room-popup__head">
          <div className="chat-room-popup__head-copy">
            <p className="chat-room-popup__eyebrow">Chat room</p>
            <h2 id="chat-room-popup-title">{partner}</h2>
            <p className="chat-room-popup__sub">
              {inquiry?.tour?.title
                ? `About ${inquiry.tour.title}`
                : "Ask questions or add notes without leaving this page."}
            </p>
          </div>
          <button
            type="button"
            className="chat-room-popup__close"
            onClick={requestExit}
            aria-label="Close chat"
          >
            ×
          </button>
        </header>

        <div className="chat-room-popup__body" ref={listRef}>
          {loading && !inquiry ? <p className="muted">Loading conversation…</p> : null}
          {error ? <p className="form-error">{error}</p> : null}
          {inquiry?.thread && inquiry.thread.length > 0 ? (
            <InquiryThread messages={inquiry.thread} hideTitle compact currentUserId={user?.id} />
          ) : !loading ? (
            <div className="chat-room-popup__empty">
              <p>
                {isAgencyViewer ? (
                  <>
                    Chat with <strong>{partner}</strong> about this inquiry.
                  </>
                ) : (
                  <>
                    Your request was sent to <strong>{partner}</strong>.
                  </>
                )}
              </p>
              <p className="muted">
                {emptyHint ??
                  (isAgencyViewer
                    ? "Reply below — they'll see it in real time."
                    : "Add a note below — they'll reply here.")}
              </p>
            </div>
          ) : null}
          <TypingIndicator names={typing.map((t) => t.name)} />
        </div>

        <footer className="chat-room-popup__foot">
          <form className="chat-room-popup__compose" onSubmit={sendMessage}>
            <label htmlFor="chat-room-draft" className="sr-only">
              Message
            </label>
            <textarea
              id="chat-room-draft"
              rows={3}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                onComposeChange(e.target.value);
              }}
              placeholder="Write a message…"
              required
            />
            <div className="chat-room-popup__actions">
              <Link
                to={roomLink}
                className="chat-room-popup__full"
                data-chat-nav-allow
                onClick={leaveWithoutConfirm}
              >
                Open full trip room
              </Link>
              <button type="submit" className="btn btn-primary" disabled={sending || !draft.trim()}>
                {sending ? "Sending…" : "Send"}
              </button>
            </div>
          </form>
        </footer>
      </aside>
    </div>,
    document.body
  );
}
