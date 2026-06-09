import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EntityTypeLineIcon } from "../icons/LineIcons";
import { ModuleHeader } from "../module/ModuleHeader";
import type { ItineraryView } from "../../types/itinerary";

const KIND_LABEL: Record<string, string> = {
  REQUIRED: "Included",
  OPTIONAL: "Optional upgrade",
  UPGRADE: "Premium add-on",
};

type Props = {
  itinerary: ItineraryView;
  shareToken?: string;
  showRespondActions?: boolean;
  responding?: boolean;
  onRespond?: (action: "accept" | "revision" | "decline") => void;
};

export function ItineraryDreamView({
  itinerary,
  shareToken,
  showRespondActions,
  responding,
  onRespond,
}: Props) {
  const [copied, setCopied] = useState(false);
  const dayCount = itinerary.days?.length ?? 0;
  const agency = itinerary.inquiry?.agency;

  const heroTitle = itinerary.title || "Your Sri Lanka journey";
  const heroSubtitle = useMemo(() => {
    const parts: string[] = [];
    if (itinerary.inquiry?.tourist?.name) {
      parts.push(`Crafted for ${itinerary.inquiry.tourist.name}`);
    }
    if (agency?.name) parts.push(agency.name);
    if (dayCount) parts.push(`${dayCount} day${dayCount === 1 ? "" : "s"}`);
    return parts.join(" · ");
  }, [itinerary.inquiry?.tourist?.name, agency?.name, dayCount]);

  async function copyShareLink() {
    if (!shareToken) return;
    const url = `${window.location.origin}/itinerary/${shareToken}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="module-shell module-itinerary itin-dream">
      <section className="itin-hero">
        <div className="itin-hero-inner">
          {agency && (
            <Link to={`/agencies/${agency.slug}`} className="itin-hero-agency">
              {agency.name}
            </Link>
          )}
          <h1 className="itin-hero-title">{heroTitle}</h1>
          {heroSubtitle && <p className="itin-hero-sub">{heroSubtitle}</p>}
          <div className="itin-hero-tags">
            <span className="tag">Dream itinerary</span>
            {dayCount > 0 && <span className="tag">{dayCount} days</span>}
          </div>
        </div>
      </section>

      <div className="itin-body">
        <ModuleHeader
          module="itinerary"
          title="Day by day"
          subtitle="Picture each moment — scroll through your journey as it unfolds."
        >
          {shareToken && (
            <button type="button" className="btn btn-ghost" onClick={copyShareLink}>
              {copied ? "Link copied" : "Copy share link"}
            </button>
          )}
        </ModuleHeader>

        {itinerary.notes && (
          <blockquote className="itin-notes">{itinerary.notes}</blockquote>
        )}

        <div className="itin-layout">
          <div className="itin-timeline">
            {!itinerary.days?.length ? (
              <p className="muted">Itinerary days will appear here once added.</p>
            ) : (
              itinerary.days.map((day) => (
                <article key={day.dayNumber} className="itin-day">
                  <div className="itin-day-marker">
                    <span className="itin-day-dot" aria-hidden="true" />
                    <span className="itin-day-num">Day {day.dayNumber}</span>
                  </div>
                  <div className="itin-day-content">
                    {day.title && <h3 className="itin-day-title">{day.title}</h3>}
                    <ul className="itin-moments">
                      {day.lineItems.map((item, i) => (
                        <li
                          key={`${day.dayNumber}-${i}`}
                          className={`itin-moment itin-moment--${item.kind.toLowerCase()}`}
                        >
                          <span className="itin-moment-icon" aria-hidden="true">
                            <EntityTypeLineIcon type={item.entity?.type ?? "OTHER"} size={16} />
                          </span>
                          <div className="itin-moment-body">
                            <div className="itin-moment-head">
                              <strong>{item.entity?.name || item.label}</strong>
                              <span className="itin-moment-kind">
                                {KIND_LABEL[item.kind] ?? item.kind}
                              </span>
                            </div>
                            {item.label && item.entity?.name && (
                              <p className="itin-moment-label">{item.label}</p>
                            )}
                            {item.notes && (
                              <p className="itin-moment-notes">{item.notes}</p>
                            )}
                            <p className="itin-moment-price">
                              {item.priceLkr != null
                                ? `LKR ${item.priceLkr.toLocaleString()}`
                                : item.priceOnRequest
                                  ? "Price on request"
                                  : "Included in package"}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              ))
            )}
          </div>

          <aside className="itin-summary-panel">
            <div className="itin-summary-card">
              <h3>Investment overview</h3>
              <dl className="itin-summary-list">
                <div>
                  <dt>Base package</dt>
                  <dd>LKR {itinerary.baseTotal.toLocaleString()}</dd>
                </div>
                <div>
                  <dt>Optional experiences</dt>
                  <dd>up to LKR {itinerary.optionalTotal.toLocaleString()}</dd>
                </div>
                <div className="itin-summary-total">
                  <dt>Maximum total</dt>
                  <dd>LKR {itinerary.grandMax.toLocaleString()}</dd>
                </div>
              </dl>
              <p className="itin-summary-foot muted">
                Final price depends on which optional upgrades you choose.
              </p>
            </div>

            {showRespondActions && onRespond && (
              <div className="itin-respond-card">
                <h3>Love this journey?</h3>
                <p className="muted">Confirm or ask your agency to refine the plan.</p>
                <div className="itin-respond-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={responding}
                    onClick={() => onRespond("accept")}
                  >
                    Accept itinerary
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={responding}
                    onClick={() => onRespond("revision")}
                  >
                    Request changes
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={responding}
                    onClick={() => onRespond("decline")}
                  >
                    Decline
                  </button>
                </div>
              </div>
            )}

            {agency && (
              <Link to={`/agencies/${agency.slug}`} className="btn btn-teal itin-agency-cta">
                View {agency.name}
              </Link>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
