import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { resolveImageUrl } from "@tourpilot/shared";
import type { HeroSlide } from "./displayTypes";

type Props = {
  slides: HeroSlide[];
};

type ExpandTransform = {
  originX: number;
  originY: number;
  scale: number;
};

const CYCLE_MS = 5200;
const EXIT_MS = 850;
const EXPAND_MS = 1150;

function measureStripTransform(
  stripEl: HTMLElement,
  mediaEl: HTMLElement
): ExpandTransform {
  const strip = stripEl.getBoundingClientRect();
  const media = mediaEl.getBoundingClientRect();
  const originX = ((strip.left + strip.width / 2 - media.left) / media.width) * 100;
  const originY = ((strip.top + strip.height / 2 - media.top) / media.height) * 100;
  const scaleX = strip.width / media.width;
  const scaleY = strip.height / media.height;
  const scale = Math.min(Math.max(scaleX, scaleY), 0.28);

  return { originX, originY, scale };
}

export function AgencyHeroBanner({ slides }: Props) {
  const tiles = useMemo(
    () =>
      slides.map((s) => ({
        url: resolveImageUrl(s.url),
        label: s.label?.trim() || "",
      })),
    [slides]
  );

  const mediaRef = useRef<HTMLDivElement>(null);
  const stripRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const expandRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(0);
  const finishTimerRef = useRef<number | null>(null);
  const expandFinishedRef = useRef(false);

  const [activeIndex, setActiveIndex] = useState(0);
  const [leavingIndex, setLeavingIndex] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [expand, setExpand] = useState<{
    index: number;
    transform: ExpandTransform;
    phase: "from" | "to";
  } | null>(null);

  const finishExpand = useCallback((index: number) => {
    if (expandFinishedRef.current) return;
    expandFinishedRef.current = true;
    activeRef.current = index;
    setActiveIndex(index);
    setLeavingIndex(null);
    setExpand(null);
    window.setTimeout(() => {
      expandFinishedRef.current = false;
    }, 120);
  }, []);

  const startExpand = useCallback(
    (index: number) => {
      const stripEl = stripRefs.current[index];
      const mediaEl = mediaRef.current;
      if (!stripEl || !mediaEl) {
        setLeavingIndex(activeRef.current);
        activeRef.current = index;
        setActiveIndex(index);
        window.setTimeout(() => setLeavingIndex(null), EXIT_MS);
        return;
      }
      expandFinishedRef.current = false;
      setLeavingIndex(activeRef.current);
      setExpand({
        index,
        transform: measureStripTransform(stripEl, mediaEl),
        phase: "from",
      });
    },
    [tiles.length]
  );

  const advance = useCallback(
    (next: number) => {
      if (tiles.length === 0) return;
      const normalized = ((next % tiles.length) + tiles.length) % tiles.length;
      if (normalized === activeRef.current) return;
      startExpand(normalized);
    },
    [startExpand, tiles.length]
  );

  useEffect(() => {
    if (!expand || expand.phase !== "from") return;

    const raf = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setExpand((prev) => (prev ? { ...prev, phase: "to" } : null));
      });
    });

    return () => window.cancelAnimationFrame(raf);
  }, [expand?.index, expand?.phase]);

  useEffect(() => {
    if (!expand || expand.phase !== "to") return;

    const node = expandRef.current;
    const onDone = () => finishExpand(expand.index);

    if (node) {
      node.addEventListener("transitionend", onDone, { once: true });
    }

    finishTimerRef.current = window.setTimeout(onDone, EXPAND_MS + 120);

    return () => {
      node?.removeEventListener("transitionend", onDone);
      if (finishTimerRef.current) window.clearTimeout(finishTimerRef.current);
    };
  }, [expand, finishExpand]);

  useEffect(() => {
    if (leavingIndex === null || expand) return;
    const timer = window.setTimeout(() => setLeavingIndex(null), EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [leavingIndex, activeIndex, expand]);

  useEffect(() => {
    if (tiles.length <= 1 || paused || expand) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = window.setInterval(() => {
      advance(activeRef.current + 1);
    }, CYCLE_MS);

    return () => window.clearInterval(timer);
  }, [tiles.length, paused, expand, advance]);

  if (tiles.length === 0) return null;

  const expandStyle: CSSProperties | undefined = expand
    ? ({
        "--expand-origin-x": `${expand.transform.originX}%`,
        "--expand-origin-y": `${expand.transform.originY}%`,
        "--expand-scale": expand.phase === "from" ? expand.transform.scale : 1,
      } as CSSProperties)
    : undefined;

  return (
    <>
      <div
        className={`agency-hero-banner__media${expand ? " is-expanding" : ""}`}
        ref={mediaRef}
        aria-hidden="true"
      >
        <div className="agency-hero-banner__stage">
          {tiles.map((tile, i) => (
            <div
              key={tile.url}
              className={`agency-hero-banner__frame${i === activeIndex ? " is-active" : ""}${
                i === leavingIndex ? " is-leaving" : ""
              }${expand && i === leavingIndex ? " is-expand-out" : ""}`}
            >
              <img src={tile.url} alt="" loading={i === 0 ? "eager" : "lazy"} decoding="async" />
            </div>
          ))}
        </div>

        {expand && (
          <div
            ref={expandRef}
            className={`agency-hero-banner__expand${expand.phase === "to" ? " is-revealed" : ""}`}
            style={expandStyle}
          >
            <img src={tiles[expand.index].url} alt="" decoding="async" />
          </div>
        )}
      </div>

      {tiles.length > 1 && (
        <div
          className="agency-hero-banner__strips"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          {tiles.map((tile, i) => (
            <button
              key={`${tile.url}-strip`}
              ref={(el) => {
                stripRefs.current[i] = el;
              }}
              type="button"
              className={`agency-hero-banner__strip${i === activeIndex ? " is-active" : ""}${
                i < activeIndex ? " is-seen" : ""
              }${expand?.index === i ? " is-launching" : ""}`}
              style={{ "--strip-index": i } as CSSProperties}
              onClick={() => advance(i)}
              aria-label={tile.label || `Show image ${i + 1}`}
              aria-current={i === activeIndex ? "true" : undefined}
            >
              <img src={tile.url} alt="" loading="lazy" decoding="async" />
              <span className="agency-hero-banner__strip-shine" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </>
  );
}
