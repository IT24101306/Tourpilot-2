import { useEffect, useState } from "react";
import type { ChatAssistSuggestion, SoftAiMoment } from "@tourpilot/shared";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";

type AssistPayload = {
  suggestions: ChatAssistSuggestion[];
  moments: SoftAiMoment[];
  proposalIntro?: string;
};

type Props = {
  inquiryId: string;
  onInsertDraft: (text: string) => void;
  /** Show proposal intro helper for agencies */
  showProposalIntro?: boolean;
  onUseProposalIntro?: (text: string) => void;
};

/** Soft AI chat assist — rule-based drafts agencies can insert into compose. */
export function ChatAssistBar({
  inquiryId,
  onInsertDraft,
  showProposalIntro,
  onUseProposalIntro,
}: Props) {
  const { token, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<AssistPayload | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !token || !inquiryId) return;
    setLoading(true);
    api<AssistPayload>(`/smart/inquiries/${inquiryId}/assist`, { token })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [open, token, inquiryId]);

  if (user?.role !== "AGENCY" && user?.role !== "INFLUENCER") return null;

  return (
    <div className="chat-assist">
      <button
        type="button"
        className="chat-assist__toggle btn btn-ghost"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? "Hide assist" : "Chat assist"}
      </button>
      {open && (
        <div className="chat-assist__panel">
          {loading && <p className="muted">Loading suggestions…</p>}
          {!loading && data?.moments?.[0] && (
            <p className="chat-assist__moment">
              <strong>{data.moments[0].title}</strong> — {data.moments[0].body}
            </p>
          )}
          {!loading && data?.suggestions?.length ? (
            <ul className="chat-assist__suggestions">
              {data.suggestions.map((s) => (
                <li key={s.id}>
                  <button type="button" className="btn btn-ghost" onClick={() => onInsertDraft(s.draft)}>
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {showProposalIntro && data?.proposalIntro && onUseProposalIntro ? (
            <button
              type="button"
              className="btn btn-teal"
              onClick={() => onUseProposalIntro(data.proposalIntro!)}
            >
              Use draft proposal intro
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
