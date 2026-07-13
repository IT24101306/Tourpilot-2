import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { createPortal } from "react-dom";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { lockBodyScroll, unlockBodyScroll } from "../../lib/scrollLock";
import type { InquiryDetail } from "../../types/negotiation";
import { InquiryThread } from "./InquiryThread";

type Props = {
  open: boolean;
  inquiryId: string | null;
  partnerName?: string | null;
  onClose: () => void;
};

export function ChatRoomPopup({ open, inquiryId, partnerName, onClose }: Props) {
  const { token } = useAuth();
  const listRef = useRef<HTMLDivElement>(null);
  const [inquiry, setInquiry] = useState<InquiryDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!token || !inquiryId) return;
    setLoading(true);
    setError("");
    try {
      const detail = await api<InquiryDetail>(`/inquiries/${inquiryId}`, { token });
      setInquiry(detail);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load chat room");
    } finally {
      setLoading(false);
    }
  }, [token, inquiryId]);

  useEffect(() => {
    if (!open || !inquiryId) {
      setInquiry(null);
      setDraft("");
      setError("");
      return;
    }
    void load();
  }, [open, inquiryId, load]);

  useEffect(() => {
    if (!open) return;
    lockBodyScroll();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      unlockBodyScroll();
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !inquiry?.thread?.length) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [open, inquiry?.thread]);

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !token || !inquiryId) return;
    setSending(true);
    setError("");
    try {
      await api(`/inquiries/${inquiryId}/messages`, {
        method: "POST",
        token,
        body: JSON.stringify({ message: text }),
      });
      setDraft("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  if (!open || !inquiryId) return null;

  const partner =
    partnerName?.trim() ||
    (inquiry?.whiteLabel && inquiry.handlerInfluencer?.name
      ? inquiry.handlerInfluencer.name
      : inquiry?.agency?.name) ||
    "your travel partner";

  return createPortal(
    <div className="chat-room-popup" role="presentation" onClick={onClose}>
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
          <button type="button" className="chat-room-popup__close" onClick={onClose} aria-label="Close chat">
            ×
          </button>
        </header>

        <div className="chat-room-popup__body" ref={listRef}>
          {loading && !inquiry ? <p className="muted">Loading conversation…</p> : null}
          {error ? <p className="form-error">{error}</p> : null}
          {inquiry?.thread && inquiry.thread.length > 0 ? (
            <InquiryThread messages={inquiry.thread} hideTitle compact />
          ) : !loading ? (
            <div className="chat-room-popup__empty">
              <p>
                Your request was sent to <strong>{partner}</strong>.
              </p>
              <p className="muted">Add a note below — they’ll reply here.</p>
            </div>
          ) : null}
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
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Write a message…"
              required
            />
            <div className="chat-room-popup__actions">
              <Link to={`/trips?room=${inquiryId}`} className="chat-room-popup__full" onClick={onClose}>
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
