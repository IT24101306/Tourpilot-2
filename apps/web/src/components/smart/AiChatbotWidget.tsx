import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { ChatbotLeadHints, ChatbotLink, ChatbotMessage } from "@tourpilot/shared";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { SupportAgentsModal } from "../support/SupportAgentsModal";
import { currentPath, loginPath } from "../../utils/authRedirect";
import {
  agencyInquiryHandoffPath,
  buildChatSummaryMessage,
  buildPlanPrefillPath,
  saveChatHandoff,
} from "../../lib/chatHandoff";

type UiMessage = ChatbotMessage & { links?: ChatbotLink[] };

const QUICK_STARTERS = [
  { label: "7-day beaches", text: "Plan a relaxed 7-day Sri Lanka beach trip for 2 people." },
  { label: "Family safari", text: "Suggest a family-friendly safari and culture itinerary for 5 days." },
  { label: "Hill country", text: "I want tea country, trains, and cool weather — what should I do?" },
  { label: "Best season?", text: "When is the best time to visit Sri Lanka for beaches and wildlife?" },
] as const;

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

function mergeLead(prev: ChatbotLeadHints, next: ChatbotLeadHints): ChatbotLeadHints {
  return {
    days: next.days !== undefined ? next.days : prev.days,
    pax: next.pax !== undefined ? next.pax : prev.pax,
    interests:
      next.interests !== undefined
        ? next.interests
        : prev.interests,
    budgetBand: next.budgetBand !== undefined ? next.budgetBand : prev.budgetBand,
    preferredAgencySlug:
      next.preferredAgencySlug !== undefined
        ? next.preferredAgencySlug
        : prev.preferredAgencySlug,
    readyForInquiry:
      next.readyForInquiry !== undefined ? next.readyForInquiry : prev.readyForInquiry,
  };
}

export function AiChatbotWidget() {
  const { pathname } = useLocation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const visible = shouldShowChatbot(pathname);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [lead, setLead] = useState<ChatbotLeadHints>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supportOpen, setSupportOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const returnPath = currentPath(location);

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
      setLead((prev) => mergeLead(prev, result.lead || {}));
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

  function agencySlugFromChat(): string | null {
    if (lead.preferredAgencySlug) return lead.preferredAgencySlug;
    for (const m of [...messages].reverse()) {
      for (const link of m.links || []) {
        const match = link.href.match(/^\/agencies\/([a-z0-9-]+)/i);
        if (match?.[1]) return match[1];
        const tourMatch = link.href.match(/^\/tours\/([a-z0-9-]+)\//i);
        if (tourMatch?.[1]) return tourMatch[1];
      }
    }
    return null;
  }

  function startInquiryHandoff() {
    const agencySlug = agencySlugFromChat();
    const message = buildChatSummaryMessage(messages, lead);
    saveChatHandoff({
      agencySlug: agencySlug || undefined,
      pax: lead.pax ?? undefined,
      days: lead.days,
      interests: lead.interests,
      budgetBand: lead.budgetBand,
      message,
      createdAt: new Date().toISOString(),
    });

    if (!user) {
      const target = agencySlug
        ? agencyInquiryHandoffPath(agencySlug)
        : buildPlanPrefillPath(lead, message);
      navigate(loginPath(target));
      setOpen(false);
      return;
    }

    if (user.role !== "TOURIST") {
      setError("Switch to a tourist account to send an inquiry to an agency.");
      return;
    }

    if (!agencySlug) {
      setError("Pick an agency or tour link from the chat first, then tap Send inquiry.");
      return;
    }

    navigate(agencyInquiryHandoffPath(agencySlug));
    setOpen(false);
  }

  function openTripPlanner() {
    const notes = messages
      .filter((m) => m.role === "user")
      .slice(-3)
      .map((m) => m.content)
      .join(" · ");
    navigate(buildPlanPrefillPath(lead, notes));
    setOpen(false);
  }

  const showHandoff = messages.length > 0 || Boolean(lead.readyForInquiry);

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
              <>
                <p className="ai-chatbot__hint">
                  Ask about destinations, seasons, budgets, or packages. Replies come from the AI —
                  starters only send your message.
                </p>
                <div className="ai-chatbot__starters">
                  {QUICK_STARTERS.map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      className="ai-chatbot__starter"
                      disabled={loading}
                      onClick={() => void send(s.text)}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </>
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

          <div className="ai-chatbot__actions">
            <button
              type="button"
              className="ai-chatbot__action-btn"
              onClick={() => {
                setSupportOpen(true);
              }}
            >
              Talk to a human
            </button>
            {showHandoff && (
              <>
                <button
                  type="button"
                  className="ai-chatbot__action-btn"
                  onClick={openTripPlanner}
                >
                  Open trip planner
                </button>
                <button
                  type="button"
                  className="ai-chatbot__action-btn ai-chatbot__action-btn--primary"
                  onClick={startInquiryHandoff}
                >
                  Send inquiry
                </button>
              </>
            )}
          </div>

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

      <SupportAgentsModal open={supportOpen} onClose={() => setSupportOpen(false)} />
    </div>
  );
}
