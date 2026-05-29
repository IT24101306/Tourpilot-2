type PendingAgency = {
  id: string;
  name: string;
  owner: { name: string; phone: string; email?: string | null };
};

type Props = {
  items: PendingAgency[];
  onApprove: (id: string) => void;
  onReject: (id: string, name: string) => void;
  approvingId?: string | null;
};

export function ApprovalQueue({ items, onApprove, onReject, approvingId }: Props) {
  if (items.length === 0) {
    return (
      <div className="gov-empty-queue">
        <p>No agencies waiting for approval.</p>
      </div>
    );
  }

  return (
    <ul className="gov-approval-list">
      {items.map((a) => (
        <li key={a.id}>
          <article className="gov-approval-card">
            <div className="gov-approval-body">
              <strong>{a.name}</strong>
              <p className="muted">
                Owner: {a.owner.name} · {a.owner.phone}
                {a.owner.email ? ` · ${a.owner.email}` : ""}
              </p>
            </div>
            <div className="gov-approval-actions">
              <button
                type="button"
                className="btn btn-ghost gov-btn-danger-outline"
                disabled={approvingId === a.id}
                onClick={() => onReject(a.id, a.name)}
              >
                Reject
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={approvingId === a.id}
                onClick={() => onApprove(a.id)}
              >
                {approvingId === a.id ? "Working…" : "Approve"}
              </button>
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}
