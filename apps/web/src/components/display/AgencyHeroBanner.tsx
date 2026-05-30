import { useMemo, type CSSProperties } from "react";
import { resolveImageUrl } from "@tourpilot/shared";
import type { HeroSlide } from "./displayTypes";

type Props = {
  slides: HeroSlide[];
};

export function AgencyHeroBanner({ slides }: Props) {
  const urls = useMemo(
    () =>
      slides.map((s) => ({
        url: resolveImageUrl(s.url),
        label: s.label?.trim() || "",
      })),
    [slides]
  );

  const loop = urls.length > 1 ? [...urls, ...urls] : urls;
  const animate = urls.length > 1;

  return (
    <div className="agency-hero-banner__media" aria-hidden="true">
      <div
        className={`agency-hero-banner__track${animate ? " agency-hero-banner__track--animate" : ""}`}
        style={
          animate
            ? ({ "--hero-slide-count": urls.length } as CSSProperties)
            : undefined
        }
      >
        {loop.map((slide, i) => (
          <div key={`${slide.url}-${i}`} className="agency-hero-banner__slide">
            <img src={slide.url} alt="" loading={i === 0 ? "eager" : "lazy"} decoding="async" />
            {slide.label && <span className="agency-hero-banner__slide-label">{slide.label}</span>}
          </div>
        ))}
      </div>
      <div className="agency-hero-banner__veil" />
    </div>
  );
}
