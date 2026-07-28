import { useMemo, useState } from "react";
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
  /** When false, hide the built-in Expand all control (parent renders its own). */
  showExpandAll?: boolean;
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
  showExpandAll = true,
}: Props) {
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  const [activeKeyLocal, setActiveKeyLocal] = useState<string | null>(null);
  const activeKey = activeKeyProp ?? activeKeyLocal;

  const allItemKeys = useMemo(
    () => days.flatMap((day) => day.items.map((item) => item.key)),
    [days]
  );
  const allExpanded =
    allItemKeys.length > 0 && allItemKeys.every((key) => expandedKeys[key]);

  function setActiveKey(key: string | null) {
    if (onActiveKeyChange) onActiveKeyChange(key);
    else setActiveKeyLocal(key);
  }

  function toggleExpanded(key: string) {
    setExpandedKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleExpandAll() {
    if (allExpanded) {
      setExpandedKeys({});
      setActiveKey(null);
      return;
    }
    const next: Record<string, boolean> = {};
    for (const key of allItemKeys) next[key] = true;
    setExpandedKeys(next);
  }

  if (!days.length) return null;

  return (
    <div className={`itin-explore${compact ? " itin-explore--compact" : ""}`}>
      {showExpandAll && allItemKeys.length > 0 ? (
        <div className="itin-explore-toolbar">
          <button
            type="button"
            className="btn btn-ghost itin-explore-toggle"
            onClick={toggleExpandAll}
            aria-pressed={allExpanded}
          >
            {allExpanded ? "Collapse all" : "Expand all"}
          </button>
        </div>
      ) : null}
      <div className="itin-explore-layout itin-explore-layout--solo">
        <div className="itin-timeline itin-timeline--compact">
          {days.map((day) => (
            <article key={day.dayNumber} className="itin-day">
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
                    const expanded = Boolean(expandedKeys[item.key]);

                    return (
                      <li
                        key={item.key}
                        className={`itin-moment itin-moment--${item.kind.toLowerCase()}${isActive ? " is-active" : ""}${expanded ? " itin-moment--expanded" : ""}`}
                      >
                        <button
                          type="button"
                          className="itin-moment-trigger"
                          aria-expanded={expanded}
                          onClick={() => {
                            toggleExpanded(item.key);
                            setActiveKey(expanded ? null : item.key);
                          }}
                          onMouseEnter={() => {
                            if (mediaBundle.mainImageUrl) setActiveKey(item.key);
                          }}
                          onMouseLeave={() => {
                            if (!expanded) setActiveKey(null);
                          }}
                        >
                          <span className="itin-moment-icon" aria-hidden="true">
                            <EntityTypeLineIcon type={item.entity?.type ?? "OTHER"} size={16} />
                          </span>
                          <div className="itin-moment-head">
                            <strong>{name}</strong>
                            {kindLabel && (
                              <span className="itin-moment-kind">{kindLabel}</span>
                            )}
                          </div>
                        </button>

                        {expanded && (
                          <div className="itin-moment-body">
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

                            {showPrices && (
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
                        )}
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
