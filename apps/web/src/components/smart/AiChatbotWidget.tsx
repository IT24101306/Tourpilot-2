import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import type { ChatbotLeadHints, ChatbotLink, ChatbotMessage } from "@tourpilot/shared";
import { api, ApiError } from "../../api/client";

type UiMessage = ChatbotMessage & { links?: ChatbotLink[] };

function shouldShowChatbot(pathname: string): boolean {
  if (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/billing")
  ) {
    return false;
  }
  return true;
}

export function AiChatbotWidget() {
  const { pathname } = useLocation();
  const visible = shouldShowChatbot(pathname);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [lead, setLead] = useState<ChatbotLeadHints>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [open, messages, loading, error]);

  if (!visible) return null;

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;

    const nextMessages: UiMessage[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setInput("");
    setError(null);
    setLoading(true);

    try {
      const result = await api<{
        reply: string;
        links: ChatbotLink[];
        lead: ChatbotLeadHints;
      }>("/smart/chatbot", {
        method: "POST",
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content: c }) => ({ role, content: c })),
          pagePath: pathname,
        }),
      });
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: result.reply, links: result.links },
      ]);
      setLead(result.lead || {});
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Chatbot request failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  return (
    <div className={`ai-chatbot${open ? " ai-chatbot--open" : ""}`}>
      {open && (
        <div className="ai-chatbot__panel" role="dialog" aria-label="TourPilot AI assistant">
          <header className="ai-chatbot__head">
            <div>
              <strong>TourPilot assistant</strong>
              <p className="ai-chatbot__sub">Sri Lanka travel help · live AI</p>
            </div>
            <button
              type="button"
              className="ai-chatbot__icon-btn"
              aria-label="Close chat"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </header>

          <div className="ai-chatbot__messages" ref={listRef}>
            {messages.length === 0 && !error && (
              <p className="ai-chatbot__hint">
                Ask about destinations, seasons, budgets, or packages. Replies come from the AI —
                nothing is pre-written here.
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={`${m.role}-${i}`}
                className={`ai-chatbot__bubble ai-chatbot__bubble--${m.role}`}
              >
                <p>{m.content}</p>
                {m.links && m.links.length > 0 && (
                  <ul className="ai-chatbot__links">
                    {m.links.map((link) => (
                      <li key={`${link.href}-${link.label}`}>
                        <Link to={link.href} onClick={() => setOpen(false)}>
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            {loading && <p className="ai-chatbot__status">Thinking…</p>}
            {error && (
              <div className="ai-chatbot__error" role="alert">
                {error}
              </div>
            )}
          </div>

          {lead.readyForInquiry && (
            <div className="ai-chatbot__lead">
              Ready to talk to an agency?{" "}
              <Link to="/plan" onClick={() => setOpen(false)}>
                Open trip planner
              </Link>
              {lead.preferredAgencySlug ? (
                <>
                  {" · "}
                  <Link
                    to={`/agencies/${lead.preferredAgencySlug}`}
                    onClick={() => setOpen(false)}
                  >
                    View suggested agency
                  </Link>
                </>
              ) : null}
            </div>
          )}

          <form className="ai-chatbot__compose" onSubmit={onSubmit}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about your Sri Lanka trip…"
              disabled={loading}
              maxLength={4000}
              aria-label="Message"
            />
            <button type="submit" className="btn btn-teal" disabled={loading || !input.trim()}>
              Send
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        className="ai-chatbot__fab"
        aria-expanded={open}
        aria-label={open ? "Close assistant" : "Open assistant"}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "×" : "ASK"}
      </button>
    </div>
  );
}
