export type ThreadMessage = {
  id: string;
  kind: "TOURIST" | "AGENCY" | "ADMIN" | "INFLUENCER" | "SYSTEM";
  body: string;
  action: string | null;
  createdAt: string;
  author: { id: string; name: string; role: string };
  /** For own messages: false = delivered, true = seen. null = not applicable. */
  seen?: boolean | null;
};

type Props = {
  messages: ThreadMessage[];
  compact?: boolean;
  hideTitle?: boolean;
  /** Current user id — used to align own bubbles and show ticks. */
  currentUserId?: string | null;
};

export function InquiryThread({ messages, compact, hideTitle, currentUserId }: Props) {
  if (!messages.length) return null;

  return (
    <div className={`inquiry-thread${compact ? " inquiry-thread-compact" : ""}`}>
      {!hideTitle && <h4 className="inquiry-thread-title">Conversation</h4>}
      <ul className="inquiry-thread-list">
        {messages.map((msg) => {
          const mine = Boolean(
            currentUserId && msg.author.id === currentUserId && msg.kind !== "SYSTEM"
          );
          return (
            <li
              key={msg.id}
              className={[
                "inquiry-thread-item",
                `inquiry-thread-item--${msg.kind.toLowerCase()}`,
                mine ? "inquiry-thread-item--mine" : "inquiry-thread-item--theirs",
              ].join(" ")}
            >
              <div className="inquiry-thread-item-head">
                <strong>{displayAuthor(msg)}</strong>
                {msg.kind === "ADMIN" && (
                  <span className="inquiry-thread-role-badge">Platform</span>
                )}
                {msg.kind === "SYSTEM" && (
                  <span className="inquiry-thread-role-badge">Policy</span>
                )}
                {msg.kind === "INFLUENCER" && (
                  <span className="inquiry-thread-role-badge">Partner</span>
                )}
                <span className="muted">{formatWhen(msg.createdAt)}</span>
                {msg.action && msg.action !== "CHAT_MESSAGE" && (
                  <span className={`inquiry-thread-badge inquiry-thread-badge--${badgeClass(msg.action)}`}>
                    {actionLabel(msg.action)}
                  </span>
                )}
              </div>
              <p className="inquiry-thread-body">{msg.body}</p>
              {mine && msg.seen != null && (
                <span
                  className={`inquiry-thread-ticks${msg.seen ? " inquiry-thread-ticks--seen" : ""}`}
                  aria-label={msg.seen ? "Seen" : "Delivered"}
                  title={msg.seen ? "Seen" : "Delivered"}
                >
                  {msg.seen ? "✓✓" : "✓"}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function TypingIndicator({ names }: { names: string[] }) {
  if (!names.length) return null;
  const label =
    names.length === 1
      ? `${names[0]} is typing`
      : names.length === 2
        ? `${names[0]} and ${names[1]} are typing`
        : "Several people are typing";

  return (
    <div className="chat-typing" aria-live="polite">
      <span className="chat-typing__dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span className="chat-typing__label">{label}</span>
    </div>
  );
}

function displayAuthor(msg: ThreadMessage) {
  if (msg.kind === "ADMIN") return "TourPilot Admin";
  if (msg.kind === "SYSTEM") return "TourPilot";
  return msg.author.name;
}

function actionLabel(action: string) {
  if (action === "ADMIN_MESSAGE") return "Platform note";
  if (action === "POLICY_REMOVED") return "Removed";
  if (action === "TOUR_INQUIRY") return "Tour inquiry";
  if (action === "INQUIRY_CREATED") return "Trip request";
  if (action === "REVISION_REQUESTED") return "Requested changes";
  if (action === "PROPOSAL_SENT") return "Proposal sent";
  if (action === "PROPOSAL_UPDATED") return "Proposal updated";
  if (action === "ACCEPTED") return "Accepted";
  if (action === "DECLINED") return "Declined";
  if (action === "INVOICE_SENT") return "Invoice sent";
  return action.replace(/_/g, " ").toLowerCase();
}

function badgeClass(action: string) {
  if (action === "ADMIN_MESSAGE") return "admin";
  if (action === "POLICY_REMOVED") return "late";
  if (action === "REVISION_REQUESTED") return "warn";
  if (action === "ACCEPTED" || action === "PROPOSAL_SENT" || action === "TOUR_INQUIRY") return "ok";
  if (action === "DECLINED") return "late";
  return "neutral";
}

function formatWhen(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
