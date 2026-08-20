import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { ChatbotLeadHints, ChatbotLink, ChatbotMessage } from "@tourpilot/shared";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { loginPath } from "../../utils/authRedirect";
import { usePublicSmartFeatures } from "../../lib/publicSmartFeatures";
import {
  agencyInquiryHandoffPath,
  buildChatSummaryMessage,
  buildPlanPrefillPath,
  clearChatSession,
  parseCatalogHref,
  readChatSession,
  saveChatHandoff,
  saveChatSession,
} from "../../lib/chatHandoff";
import {
  clearSupportSessionId,
  getOrCreateSupportGuestKey,
  readSupportSessionId,
  saveSupportSessionId,
  type SupportChatMessage,
  type SupportChatSession,
} from "../../lib/supportChat";

type UiMessage = ChatbotMessage & { links?: ChatbotLink[] };
type ChatMode = "ai" | "human";

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
    interests: next.interests !== undefined ? next.interests : prev.interests,
    budgetBand: next.budgetBand !== undefined ? next.budgetBand : prev.budgetBand,
    preferredAgencySlug:
      next.preferredAgencySlug !== undefined
        ? next.preferredAgencySlug
        : prev.preferredAgencySlug,
    readyForInquiry:
      next.readyForInquiry !== undefined ? next.readyForInquiry : prev.readyForInquiry,
  };
}

function initialSession(): { messages: UiMessage[]; lead: ChatbotLeadHints; open: boolean } {
  const saved = readChatSession();
  return {
    messages: saved?.messages ?? [],
    lead: saved?.lead ?? {},
    open: Boolean(saved?.open),
  };
}

export function AiChatbotWidget() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const { aiChatbotEnabled, aiTripPlannerEnabled, liveSupportEnabled, loaded: flagsLoaded } =
    usePublicSmartFeatures();
  const visible =
    shouldShowChatbot(pathname) && flagsLoaded && (aiChatbotEnabled || liveSupportEnabled);
  const boot = useRef(initialSession()).current;

  const [open, setOpen] = useState(boot.open);
  const [mode, setMode] = useState<ChatMode>(() =>
    readSupportSessionId() ? "human" : "ai"
  );
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<UiMessage[]>(boot.messages);
  const [lead, setLead] = useState<ChatbotLeadHints>(boot.lead);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tourIdByHref, setTourIdByHref] = useState<Record<string, string>>({});
  const [supportSession, setSupportSession] = useState<SupportChatSession | null>(null);
  const [supportMessages, setSupportMessages] = useState<SupportChatMessage[]>([]);
  const [humanConnecting, setHumanConnecting] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const resolvedTourHrefs = useRef<Record<string, string>>({});
  const guestKeyRef = useRef(getOrCreateSupportGuestKey());

  useEffect(() => {
    saveChatSession({ messages, lead, open });
  }, [messages, lead, open]);

  useEffect(() => {
    if (!flagsLoaded) return;
    if (!liveSupportEnabled) {
      setMode("ai");
      return;
    }
    if (!aiChatbotEnabled || readSupportSessionId()) {
      setMode("human");
    }
  }, [flagsLoaded, liveSupportEnabled, aiChatbotEnabled]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [open, messages, supportMessages, loading, humanConnecting, error, mode]);

  const applySupportSession = useCallback((session: SupportChatSession) => {
    setSupportSession(session);
    setSupportMessages(session.messages || []);
    saveSupportSessionId(session.id);
  }, []);

  const loadSupportSession = useCallback(
    async (sessionId: string) => {
      const guestKey = guestKeyRef.current;
      const qs = guestKey ? `?guestKey=${encodeURIComponent(guestKey)}` : "";
      const session = await api<SupportChatSession>(`/support/chat/sessions/${sessionId}${qs}`, {
        token,
      });
      applySupportSession(session);
      return session;
    },
    [applySupportSession, token]
  );

  const ensureHumanSession = useCallback(async () => {
    setHumanConnecting(true);
    setError(null);
    try {
      const existingId = readSupportSessionId();
      if (existingId) {
        try {
          await loadSupportSession(existingId);
          return;
        } catch {
          clearSupportSessionId();
        }
      }

      const session = await api<SupportChatSession>("/support/chat/sessions", {
        method: "POST",
        token,
        body: JSON.stringify({
          guestKey: guestKeyRef.current,
          pagePath: pathname,
          contactName: user?.name ?? null,
          contactEmail: user?.email ?? null,
          chatbotSummary: messages.length
            ? buildChatSummaryMessage(messages, lead)
            : null,
        }),
      });
      applySupportSession(session);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not reach human support";
      setError(msg);
    } finally {
      setHumanConnecting(false);
    }
  }, [applySupportSession, lead, loadSupportSession, messages, pathname, token, user?.email, user?.name]);

  /** Resume human thread when widget opens in human mode. */
  useEffect(() => {
    if (!visible || !open || mode !== "human" || !liveSupportEnabled) return;
    if (supportSession) return;
    void ensureHumanSession();
  }, [visible, open, mode, supportSession, ensureHumanSession, liveSupportEnabled]);

  /** Poll human chat while open. */
  useEffect(() => {
    if (!visible || !open || mode !== "human" || !liveSupportEnabled) return;
    const sessionId = supportSession?.id || readSupportSessionId();
    if (!sessionId) return;

    let cancelled = false;
    const tick = async () => {
      try {
        const guestKey = guestKeyRef.current;
        const qs = guestKey ? `?guestKey=${encodeURIComponent(guestKey)}` : "";
        const session = await api<SupportChatSession>(
          `/support/chat/sessions/${sessionId}${qs}`,
          { token }
        );
        if (!cancelled) applySupportSession(session);
      } catch {
        /* keep last known messages */
      }
    };

    const id = window.setInterval(() => void tick(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [visible, open, mode, supportSession?.id, token, applySupportSession, liveSupportEnabled]);

  /** Resolve tour slug links → tour ids for one-click inquire. */
  useEffect(() => {
    const pending: Array<{ href: string; agencySlug: string; tourSlug: string }> = [];
    for (const m of messages) {
      for (const link of m.links || []) {
        const parsed = parseCatalogHref(link.href);
        if (!parsed?.tourSlug) continue;
        if (resolvedTourHrefs.current[link.href]) continue;
        pending.push({
          href: link.href,
          agencySlug: parsed.agencySlug,
          tourSlug: parsed.tourSlug,
        });
      }
    }
    if (!pending.length) return;

    let cancelled = false;
    void (async () => {
      const updates: Record<string, string> = {};
      await Promise.all(
        pending.map(async ({ href, agencySlug, tourSlug }) => {
          try {
            const tour = await api<{ id: string }>(`/tours/public/${agencySlug}/${tourSlug}`);
            if (tour?.id) updates[href] = tour.id;
          } catch {
            /* ignore missing tours */
          }
        })
      );
      if (cancelled || !Object.keys(updates).length) return;
      resolvedTourHrefs.current = { ...resolvedTourHrefs.current, ...updates };
      setTourIdByHref((prev) => ({ ...prev, ...updates }));
    })();

    return () => {
      cancelled = true;
    };
  }, [messages]);

  async function sendAi(text: string) {
    const content = text.trim();
    if (!content || loading || !aiChatbotEnabled) return;

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

  async function sendHuman(text: string) {
    const content = text.trim();
    if (!content || loading || humanConnecting) return;
    let sessionId = supportSession?.id || readSupportSessionId();
    if (!sessionId) {
      await ensureHumanSession();
      sessionId = readSupportSessionId();
    }
    if (!sessionId) return;

    setInput("");
    setError(null);
    setLoading(true);
    try {
      const result = await api<{ session: SupportChatSession }>(
        `/support/chat/sessions/${sessionId}/messages`,
        {
          method: "POST",
          token,
          body: JSON.stringify({
            guestKey: guestKeyRef.current,
            body: content,
          }),
        }
      );
      applySupportSession(result.session);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not send message";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (mode === "human") void sendHuman(input);
    else void sendAi(input);
  }

  function agencySlugFromChat(): string | null {
    if (lead.preferredAgencySlug) return lead.preferredAgencySlug;
    for (const m of [...messages].reverse()) {
      for (const link of m.links || []) {
        const parsed = parseCatalogHref(link.href);
        if (parsed?.agencySlug) return parsed.agencySlug;
      }
    }
    return null;
  }

  function goInquiry(opts: { agencySlug: string; tourId?: string; message?: string }) {
    const message = opts.message || buildChatSummaryMessage(messages, lead);
    saveChatHandoff({
      agencySlug: opts.agencySlug,
      tourId: opts.tourId,
      pax: lead.pax ?? undefined,
      days: lead.days,
      interests: lead.interests,
      budgetBand: lead.budgetBand,
      message,
      createdAt: new Date().toISOString(),
    });

    const target = agencyInquiryHandoffPath(opts.agencySlug, { tourId: opts.tourId });

    if (!user) {
      navigate(loginPath(target));
      setOpen(false);
      return;
    }
    if (user.role !== "TOURIST") {
      setError("Switch to a tourist account to send an inquiry to an agency.");
      return;
    }
    navigate(target);
    setOpen(false);
  }

  function startInquiryHandoff() {
    const agencySlug = agencySlugFromChat();
    if (!agencySlug) {
      setError("Pick an agency or tour link from the chat first, then tap Send inquiry.");
      return;
    }
    goInquiry({ agencySlug });
  }

  function inquireFromLink(href: string) {
    const parsed = parseCatalogHref(href);
    if (!parsed) return;
    const tourId = tourIdByHref[href];
    goInquiry({
      agencySlug: parsed.agencySlug,
      tourId: parsed.tourSlug ? tourId : undefined,
    });
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

  async function talkToHuman() {
    setMode("human");
    setOpen(true);
    setError(null);
    await ensureHumanSession();
  }

  function backToAi() {
    setMode("ai");
    setError(null);
  }

  async function clearConversation() {
    const sessionId = supportSession?.id || readSupportSessionId();
    if (sessionId) {
      try {
        await api(`/support/chat/sessions/${sessionId}/leave`, {
          method: "POST",
          token,
          body: JSON.stringify({ guestKey: guestKeyRef.current }),
        });
      } catch {
        /* still clear locally */
      }
    }

    setMessages([]);
    setLead({});
    setError(null);
    setTourIdByHref({});
    resolvedTourHrefs.current = {};
    clearChatSession();
    clearSupportSessionId();
    setSupportSession(null);
    setSupportMessages([]);
    setMode("ai");
  }

  const showHandoff = mode === "ai" && (messages.length > 0 || Boolean(lead.readyForInquiry));
  const hasSomethingToClear =
    messages.length > 0 || supportMessages.length > 0 || Boolean(readSupportSessionId());

  if (!visible) return null;

  return (
    <div className={`ai-chatbot${open ? " ai-chatbot--open" : ""}`}>
      {open && (
        <div
          className="ai-chatbot__panel"
          role="dialog"
          aria-label={mode === "human" ? "TourPilot live support" : "TourPilot AI assistant"}
        >
          <header className="ai-chatbot__head">
            <div>
              <strong>{mode === "human" ? "Live support" : "TourPilot assistant"}</strong>
              <p className="ai-chatbot__sub">
                {mode === "human"
                  ? supportSession?.assignedAdmin
                    ? `Chatting with ${supportSession.assignedAdmin.name}`
                    : "A TourPilot admin will reply here"
                  : "Sri Lanka travel help · live AI"}
              </p>
            </div>
            <div className="ai-chatbot__head-actions">
              {hasSomethingToClear && (
                <button
                  type="button"
                  className="ai-chatbot__text-btn"
                  onClick={() => void clearConversation()}
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                className="ai-chatbot__icon-btn"
                aria-label="Close chat"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>
          </header>

          <div className="ai-chatbot__messages" ref={listRef}>
            {mode === "ai" && messages.length === 0 && !error && (
              <>
                <p className="ai-chatbot__hint">
                  Ask about destinations, seasons, budgets, or packages. Replies come from the AI —
                  starters only send your message.
                  {liveSupportEnabled ? " Need a person? Tap Talk to a human." : ""}
                </p>
                <div className="ai-chatbot__starters">
                  {QUICK_STARTERS.map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      className="ai-chatbot__starter"
                      disabled={loading}
                      onClick={() => void sendAi(s.text)}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </>
            )}

            {mode === "ai" &&
              messages.map((m, i) => (
                <div
                  key={`${m.role}-${i}`}
                  className={`ai-chatbot__bubble ai-chatbot__bubble--${m.role}`}
                >
                  <p>{m.content}</p>
                  {m.links && m.links.length > 0 && (
                    <ul className="ai-chatbot__links">
                      {m.links.map((link) => {
                        const catalog = parseCatalogHref(link.href);
                        const canInquire = Boolean(catalog);
                        const tourReady =
                          !catalog?.tourSlug || Boolean(tourIdByHref[link.href]);
                        return (
                          <li key={`${link.href}-${link.label}`} className="ai-chatbot__link-row">
                            <Link to={link.href} onClick={() => setOpen(false)}>
                              {link.label}
                            </Link>
                            {canInquire && (
                              <button
                                type="button"
                                className="ai-chatbot__inquire"
                                disabled={!tourReady}
                                onClick={() => inquireFromLink(link.href)}
                              >
                                Inquire
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ))}

            {mode === "human" && humanConnecting && supportMessages.length === 0 && (
              <p className="ai-chatbot__status">Connecting you to support…</p>
            )}
            {mode === "human" &&
              !humanConnecting &&
              supportMessages.length === 0 &&
              !error && (
                <p className="ai-chatbot__hint">
                  You are in a live chat with TourPilot staff. Write your question below — this
                  thread stays until you tap Clear.
                </p>
              )}
            {mode === "human" &&
              supportMessages.map((m) => (
                <div
                  key={m.id}
                  className={`ai-chatbot__bubble ai-chatbot__bubble--${
                    m.sender === "USER"
                      ? "user"
                      : m.sender === "ADMIN"
                        ? "admin"
                        : "system"
                  }`}
                >
                  {m.sender === "ADMIN" && m.authorName && (
                    <span className="ai-chatbot__sender-label">{m.authorName}</span>
                  )}
                  <p>{m.body}</p>
                </div>
              ))}

            {loading && (
              <p className="ai-chatbot__status">
                {mode === "human" ? "Sending…" : "Thinking…"}
              </p>
            )}
            {error && (
              <div className="ai-chatbot__error" role="alert">
                {error}
              </div>
            )}
          </div>

          <div className="ai-chatbot__actions">
            {mode === "ai" && liveSupportEnabled ? (
              <button type="button" className="ai-chatbot__action-btn" onClick={() => void talkToHuman()}>
                Talk to a human
              </button>
            ) : null}
            {mode === "human" && aiChatbotEnabled ? (
              <button type="button" className="ai-chatbot__action-btn" onClick={backToAi}>
                Back to AI assistant
              </button>
            ) : null}
            {showHandoff && (
              <>
                {aiTripPlannerEnabled ? (
                  <button
                    type="button"
                    className="ai-chatbot__action-btn"
                    onClick={openTripPlanner}
                  >
                    Open trip planner
                  </button>
                ) : null}
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
              placeholder={
                mode === "human"
                  ? "Message TourPilot support…"
                  : "Ask anything about your Sri Lanka trip…"
              }
              disabled={loading || humanConnecting}
              maxLength={4000}
              aria-label="Message"
            />
            <button
              type="submit"
              className="btn btn-teal"
              disabled={loading || humanConnecting || !input.trim()}
            >
              Send
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        className="ai-chatbot__fab"
        aria-expanded={open}
        aria-label={
          open
            ? "Close assistant"
            : aiChatbotEnabled
              ? "Open assistant"
              : "Open live support"
        }
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "×" : aiChatbotEnabled ? "ASK" : "HELP"}
      </button>
    </div>
  );
}
