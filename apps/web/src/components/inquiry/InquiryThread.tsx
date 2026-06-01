export type ThreadMessage = {
  id: string;
  kind: "TOURIST" | "AGENCY";
  body: string;
  action: string | null;
  createdAt: string;
  author: { id: string; name: string; role: string };
};

type Props = {
  messages: ThreadMessage[];
  compact?: boolean;
  hideTitle?: boolean;
};

export function InquiryThread({ messages, compact, hideTitle }: Props) {
  if (!messages.length) return null;

  return (
    <div className={`inquiry-thread${compact ? " inquiry-thread-compact" : ""}`}>
      {!hideTitle && <h4 className="inquiry-thread-title">Conversation</h4>}
      <ul className="inquiry-thread-list">
        {messages.map((msg) => (
          <li
            key={msg.id}
            className={`inquiry-thread-item inquiry-thread-item--${msg.kind.toLowerCase()}`}
          >
            <div className="inquiry-thread-item-head">
              <strong>{msg.author.name}</strong>
              <span className="muted">{formatWhen(msg.createdAt)}</span>
              {msg.action && (
                <span className={`inquiry-thread-badge inquiry-thread-badge--${badgeClass(msg.action)}`}>
                  {actionLabel(msg.action)}
                </span>
              )}
            </div>
            <p className="inquiry-thread-body">{msg.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function actionLabel(action: string) {
  if (action === "INQUIRY_CREATED") return "Trip request";
  if (action === "REVISION_REQUESTED") return "Requested changes";
  if (action === "PROPOSAL_SENT") return "Proposal sent";
  if (action === "PROPOSAL_UPDATED") return "Proposal updated";
  if (action === "ACCEPTED") return "Accepted";
  if (action === "DECLINED") return "Declined";
  return action.replace(/_/g, " ").toLowerCase();
}

function badgeClass(action: string) {
  if (action === "REVISION_REQUESTED") return "warn";
  if (action === "ACCEPTED" || action === "PROPOSAL_SENT") return "ok";
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
