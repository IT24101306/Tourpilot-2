import { useState } from "react";
import { normalizeEntityMedia, type EntityMediaItem } from "@tourpilot/shared";
import { FormatLkr } from "../currency/FormatLkr";
import { CoverImage } from "../CoverImage";
import { EntityTypeLineIcon } from "../icons/LineIcons";
import { RichTextHtml } from "../richtext/RichTextHtml";

export type ItineraryExploreEntity = {
  name: string;
  type?: string;
  description?: string | null;
  media?: unknown;
};

export type ItineraryExploreItem = {
  key: string;
  kind: string;
  label: string | null;
  priceLkr?: number | null;
  priceOnRequest?: boolean;
  notes?: string | null;
  entity?: ItineraryExploreEntity | null;
};

export type ItineraryExploreDay = {
  dayNumber: number;
  title: string | null;
  items: ItineraryExploreItem[];
};

type Props = {
  days: ItineraryExploreDay[];
  compact?: boolean;
  showPrices?: boolean;
  activeKey?: string | null;
  onActiveKeyChange?: (key: string | null) => void;
  kindLabels?: Record<string, string>;
};

function itemName(item: ItineraryExploreItem) {
  return item.entity?.name || item.label || "Stop";
}

function EntityExtraMedia({ items }: { items: EntityMediaItem[] }) {
  if (!items.length) return null;
  return (
    <div className="itin-entity-extra-media">
      {items.map((m, idx) => {
        if (m.kind === "image") {
          return (
            <CoverImage
              key={`${m.url}-${idx}`}
              src={m.url}
              className="itin-entity-extra-thumb"
              alt={m.label || ""}
            />
          );
        }
        if (m.kind === "video") {
          return (
            <a
              key={`${m.url}-${idx}`}
              className="itin-entity-extra-link"
              href={m.url}
              target="_blank"
              rel="noreferrer"
            >
              {m.label || "Watch video"}
            </a>
          );
        }
        return (
          <a
            key={`${m.url}-${idx}`}
            className="itin-entity-extra-link"
            href={m.url}
            target="_blank"
            rel="noreferrer"
          >
            {m.label || "View link"}
          </a>
        );
      })}
    </div>
  );
}

export function ItineraryExploreView({
  days,
  compact,
  showPrices = true,
  activeKey: activeKeyProp,
  onActiveKeyChange,
  kindLabels,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [activeKeyLocal, setActiveKeyLocal] = useState<string | null>(null);
  const activeKey = activeKeyProp ?? activeKeyLocal;

  function setActiveKey(key: string | null) {
    if (onActiveKeyChange) onActiveKeyChange(key);
    else setActiveKeyLocal(key);
  }

  if (!days.length) return null;

  return (
    <div className={`itin-explore${compact ? " itin-explore--compact" : ""}`}>
      <div className="itin-explore-toolbar">
        <p className="itin-explore-hint muted">
          {expanded
            ? "Photos and descriptions are shown beside each stop."
            : "Stops listed by day — expand to see photos and details."}
        </p>
        <button
          type="button"
          className="btn btn-ghost itin-explore-toggle"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? "Collapse" : "Expand"}
        </button>
      </div>

      <div className="itin-explore-layout itin-explore-layout--solo">
        <div className="itin-timeline itin-timeline--compact">
          {days.map((day) => (
            <article key={day.dayNumber} className="itin-day">
              <div className="itin-day-marker">
                <span className="itin-day-dot" aria-hidden="true" />
                <span className="itin-day-num">Day {day.dayNumber}</span>
              </div>
              <div className="itin-day-content">
                {day.title && <h3 className="itin-day-title">{day.title}</h3>}
                <ul className="itin-moments">
                  {day.items.map((item) => {
                    const name = itemName(item);
                    const mediaBundle = item.entity
                      ? normalizeEntityMedia(item.entity.media)
                      : { mainImageUrl: null, items: [] };
                    const kindLabel = kindLabels?.[item.kind];
                    const isActive = activeKey === item.key;

                    return (
                      <li
                        key={item.key}
                        className={`itin-moment itin-moment--${item.kind.toLowerCase()}${isActive ? " is-active" : ""}${expanded ? " itin-moment--expanded" : ""}`}
                        onMouseEnter={() => {
                          if (mediaBundle.mainImageUrl) setActiveKey(item.key);
                        }}
                        onMouseLeave={() => setActiveKey(null)}
                      >
                        <span className="itin-moment-icon" aria-hidden="true">
                          <EntityTypeLineIcon type={item.entity?.type ?? "OTHER"} size={16} />
                        </span>
                        <div className="itin-moment-body">
                          <div className="itin-moment-head">
                            <strong>{name}</strong>
                            {kindLabel && (
                              <span className="itin-moment-kind">{kindLabel}</span>
                            )}
                          </div>

                          {expanded && (
                            <div className="itin-moment-detail">
                              {item.label && item.entity?.name && (
                                <p className="itin-moment-label">{item.label}</p>
                              )}
                              {item.entity?.description && (
                                <RichTextHtml
                                  html={item.entity.description}
                                  className="itin-moment-desc"
                                />
                              )}
                              {item.notes && (
                                <p className="itin-moment-notes">{item.notes}</p>
                              )}
                              {mediaBundle.mainImageUrl && (
                                <CoverImage
                                  src={mediaBundle.mainImageUrl}
                                  className="itin-moment-media"
                                  alt={name}
                                />
                              )}
                              <EntityExtraMedia items={mediaBundle.items} />
                            </div>
                          )}

                          {showPrices && expanded && (
                            <p className="itin-moment-price">
                              {item.priceLkr != null ? (
                                <FormatLkr amount={item.priceLkr} />
                              ) : item.priceOnRequest ? (
                                "Price on request"
                              ) : (
                                "Included in package"
                              )}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </article>
          ))}
        </div>

      </div>
    </div>
  );
}
