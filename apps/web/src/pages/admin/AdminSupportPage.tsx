import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import type { SupportChatMessage, SupportChatSession } from "../../lib/supportChat";

export function AdminSupportPage() {
  const { token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState<SupportChatSession[]>([]);
  const [statusFilter, setStatusFilter] = useState<"OPEN" | "CLOSED" | "ALL">("OPEN");
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("session"));
  const [thread, setThread] = useState<SupportChatSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const loadList = useCallback(async () => {
    if (!token) return;
    const data = await api<SupportChatSession[]>(
      `/admin/support/sessions?status=${statusFilter}`,
      { token }
    );
    setRows(data);
  }, [token, statusFilter]);

  const loadThread = useCallback(
    async (id: string) => {
      if (!token) return;
      const data = await api<SupportChatSession>(`/admin/support/sessions/${id}`, { token });
      setThread(data);
    },
    [token]
  );

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    loadList()
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load support chats");
      })
      .finally(() => setLoading(false));
  }, [token, loadList]);

  useEffect(() => {
    const fromUrl = searchParams.get("session");
    if (fromUrl) setSelectedId(fromUrl);
  }, [searchParams]);

  useEffect(() => {
    if (!token || !selectedId) {
      setThread(null);
      return;
    }
    void loadThread(selectedId).catch((err) => {
      setError(err instanceof ApiError ? err.message : "Failed to load chat");
    });
  }, [token, selectedId, loadThread]);

  useEffect(() => {
    if (!token || !selectedId) return;
    const id = window.setInterval(() => {
      void loadThread(selectedId).catch(() => undefined);
      void loadList().catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(id);
  }, [token, selectedId, loadThread, loadList]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread?.messages]);

  const visitorLabel = useMemo(() => {
    if (!thread) return "";
    return (
      thread.user?.name ||
      thread.contactName ||
      thread.user?.phone ||
      "Anonymous visitor"
    );
  }, [thread]);

  function selectSession(id: string) {
    setSelectedId(id);
    setSearchParams({ session: id });
    setError(null);
  }

  async function sendReply(e: FormEvent) {
    e.preventDefault();
    if (!token || !selectedId || !input.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const updated = await api<SupportChatSession>(
        `/admin/support/sessions/${selectedId}/messages`,
        {
          method: "POST",
          token,
          body: JSON.stringify({ body: input.trim() }),
        }
      );
      setThread(updated);
      setInput("");
      await loadList();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  async function claim() {
    if (!token || !selectedId) return;
    const updated = await api<SupportChatSession>(`/admin/support/sessions/${selectedId}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ claim: true }),
    });
    setThread(updated);
    await loadList();
  }

  async function setStatus(status: "OPEN" | "CLOSED") {
    if (!token || !selectedId) return;
    const updated = await api<SupportChatSession>(`/admin/support/sessions/${selectedId}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ status }),
    });
    setThread(updated);
    await loadList();
  }

  return (
    <div className="module-shell module-governance">
      <ModuleHeader
        module="governance"
        title="Live support"
        subtitle="Reply to visitors who tap Talk to a human in the site chatbot."
      />

      <div className="admin-support">
        <aside className="admin-support__inbox">
          <div className="admin-support__filters">
            {(["OPEN", "CLOSED", "ALL"] as const).map((s) => (
              <button
                key={s}
                type="button"
                className={`btn btn-nav ${statusFilter === s ? "btn-teal" : "btn-ghost"}`}
                onClick={() => setStatusFilter(s)}
              >
                {s === "ALL" ? "All" : s === "OPEN" ? "Open" : "Closed"}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="muted">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="muted">No support chats yet.</p>
          ) : (
            <ul className="admin-support__list">
              {rows.map((row) => {
                const label =
                  row.user?.name || row.contactName || row.user?.phone || "Visitor";
                const active = row.id === selectedId;
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      className={`admin-support__row${active ? " is-active" : ""}`}
                      onClick={() => selectSession(row.id)}
                    >
                      <strong>{label}</strong>
                      <span className="muted">
                        {row.status}
                        {row.assignedAdmin ? ` · ${row.assignedAdmin.name}` : ""}
                      </span>
                      <p>{row.preview || "No messages yet"}</p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <section className="admin-support__thread">
          {!selectedId || !thread ? (
            <p className="muted">Select a chat from the inbox.</p>
          ) : (
            <>
              <header className="admin-support__head">
                <div>
                  <h2>{visitorLabel}</h2>
                  <p className="muted">
                    {thread.user?.phone ? `${thread.user.phone} · ` : ""}
                    {thread.contactEmail || thread.user?.email || "No email"}
                    {thread.pagePath ? ` · ${thread.pagePath}` : ""}
                  </p>
                </div>
                <div className="admin-support__head-actions">
                  {!thread.assignedAdmin && (
                    <button type="button" className="btn btn-ghost btn-nav" onClick={() => void claim()}>
                      Claim
                    </button>
                  )}
                  {thread.status === "OPEN" ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-nav"
                      onClick={() => void setStatus("CLOSED")}
                    >
                      Close
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-ghost btn-nav"
                      onClick={() => void setStatus("OPEN")}
                    >
                      Reopen
                    </button>
                  )}
                </div>
              </header>

              {thread.chatbotSummary && (
                <details className="admin-support__context">
                  <summary>AI chatbot context</summary>
                  <pre>{thread.chatbotSummary}</pre>
                </details>
              )}

              <div className="admin-support__messages" ref={listRef}>
                {(thread.messages || []).map((m: SupportChatMessage) => (
                  <div
                    key={m.id}
                    className={`admin-support__bubble admin-support__bubble--${m.sender.toLowerCase()}`}
                  >
                    <span className="admin-support__meta">
                      {m.sender === "ADMIN"
                        ? m.authorName || "Admin"
                        : m.sender === "USER"
                          ? "Visitor"
                          : "System"}{" "}
                      · {new Date(m.createdAt).toLocaleString()}
                    </span>
                    <p>{m.body}</p>
                  </div>
                ))}
              </div>

              {error && (
                <div className="ai-chatbot__error" role="alert">
                  {error}
                </div>
              )}

              <form className="admin-support__compose" onSubmit={(e) => void sendReply(e)}>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Reply to visitor…"
                  maxLength={4000}
                  disabled={sending || thread.status === "CLOSED"}
                />
                <button
                  type="submit"
                  className="btn btn-teal"
                  disabled={sending || !input.trim() || thread.status === "CLOSED"}
                >
                  Send
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
