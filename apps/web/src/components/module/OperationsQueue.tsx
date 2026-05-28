import { Link } from "react-router-dom";
import type { AgencyInquiry } from "../../pages/agency/types";
import {
  formatInquiryStatus,
  inquiryStatusClass,
  inquirySummary,
  nextActionLabel,
  type OpsQueueKey,
} from "../../pages/agency/operationsUtils";

const QUEUE_META: Record<
  OpsQueueKey,
  { title: string; hint: string }
> = {
  action: {
    title: "Needs your attention",
    hint: "Respond, revise, or send the next update.",
  },
  waiting: {
    title: "Waiting on traveler",
    hint: "Proposal sent — traveler has not decided yet.",
  },
  confirmed: {
    title: "Confirmed",
    hint: "Ready for execution and task assignment.",
  },
  closed: {
    title: "Closed",
    hint: "Declined or expired inquiries.",
  },
};

type Props = {
  groups: Record<OpsQueueKey, AgencyInquiry[]>;
  bookingsPath?: string;
  compact?: boolean;
};

export function OperationsQueue({
  groups,
  bookingsPath = "/dashboard/agency/negotiations",
  compact = false,
}: Props) {
  const order: OpsQueueKey[] = compact
    ? ["action", "waiting"]
    : ["action", "waiting", "confirmed", "closed"];

  return (
    <div className={`ops-queue${compact ? " ops-queue--compact" : ""}`}>
      {order.map((key) => {
        const items = groups[key];
        const meta = QUEUE_META[key];
        if (compact && items.length === 0) return null;

        return (
          <section key={key} className="ops-queue-column">
            <div className="ops-queue-column-head">
              <h3>{meta.title}</h3>
              <span className="ops-queue-count">{items.length}</span>
            </div>
            <p className="ops-queue-hint">{meta.hint}</p>
            {items.length === 0 ? (
              <p className="ops-queue-empty">Nothing here right now.</p>
            ) : (
              <ul className="ops-queue-list">
                {items.slice(0, compact ? 4 : 20).map((inq) => (
                  <li key={inq.id}>
                    <Link
                      to={`/dashboard/agency/trip-room/${inq.id}`}
                      className="ops-queue-card"
                    >
                      <div className="ops-queue-card-top">
                        <strong>{inq.tourist?.name ?? "Traveler"}</strong>
                        <span className={`agency-status ${inquiryStatusClass(inq.status)}`}>
                          {formatInquiryStatus(inq.status)}
                        </span>
                      </div>
                      <p className="ops-queue-card-meta">{inquirySummary(inq)}</p>
                      <p className="ops-queue-card-action">{nextActionLabel(inq.status)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {compact && items.length > 4 && (
              <Link to={bookingsPath} className="ops-queue-more">
                View all {items.length} →
              </Link>
            )}
          </section>
        );
      })}
    </div>
  );
}
