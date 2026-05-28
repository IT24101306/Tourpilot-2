type PendingAgency = {
  id: string;
  name: string;
  owner: { name: string; phone: string };
};

type Props = {
  items: PendingAgency[];
  onApprove: (id: string) => void;
  approvingId?: string | null;
};

export function ApprovalQueue({ items, onApprove, approvingId }: Props) {
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
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={approvingId === a.id}
              onClick={() => onApprove(a.id)}
            >
              {approvingId === a.id ? "Approving…" : "Approve"}
            </button>
          </article>
        </li>
      ))}
    </ul>
  );
}
