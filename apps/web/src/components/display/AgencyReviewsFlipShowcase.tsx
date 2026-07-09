import { useCallback, useEffect, useState } from "react";

type Review = { authorName: string; rating: number; body: string | null };

type Props = {
  reviews: Review[];
  avgRating: number;
  reviewCount: number;
  title?: string;
};

const FLIP_MS = 700;
const CYCLE_MS = 6000;

function starString(rating: number) {
  const rounded = Math.max(0, Math.min(5, Math.round(rating)));
  return "★".repeat(rounded) + "☆".repeat(5 - rounded);
}

export function AgencyReviewsFlipShowcase({
  reviews,
  avgRating,
  reviewCount,
  title = "What travelers say",
}: Props) {
  const [index, setIndex] = useState(0);
  const [flipPhase, setFlipPhase] = useState<"idle" | "out" | "in">("idle");
  const [paused, setPaused] = useState(false);

  const review = reviews[index];
  const hasMultiple = reviews.length > 1;
  const flipping = flipPhase !== "idle";

  const goTo = useCallback(
    (next: number) => {
      if (flipPhase !== "idle" || reviews.length === 0) return;
      const normalized = ((next % reviews.length) + reviews.length) % reviews.length;
      if (normalized === index) return;
      setFlipPhase("out");
      window.setTimeout(() => {
        setIndex(normalized);
        setFlipPhase("in");
        window.setTimeout(() => setFlipPhase("idle"), FLIP_MS);
      }, FLIP_MS);
    },
    [flipPhase, index, reviews.length]
  );

  useEffect(() => {
    if (!hasMultiple || paused || flipping) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = window.setInterval(() => {
      goTo(index + 1);
    }, CYCLE_MS);

    return () => window.clearInterval(timer);
  }, [hasMultiple, paused, flipping, index, goTo]);

  if (!review) return null;

  return (
    <div className="agency-review-flip-wrap">
      <div className="agency-review-flip__head">
        <h3 className="agency-reviews-title">{title}</h3>
        <div
          className="agency-review-flip__score"
          aria-label={`Average rating ${avgRating.toFixed(1)} out of 5`}
        >
          <span className="agency-review-flip__score-num">{avgRating.toFixed(1)}</span>
          <span className="agency-review-flip__score-stars" aria-hidden="true">
            {starString(avgRating)}
          </span>
          <span className="agency-review-flip__score-count">
            {reviewCount > 0 ? `${reviewCount}+ reviews` : "Traveler reviews"}
          </span>
        </div>
      </div>

      <div
        className="agency-review-flip"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {hasMultiple && (
          <button
            type="button"
            className="agency-review-flip__nav agency-review-flip__nav--prev"
            onClick={() => goTo(index - 1)}
            aria-label="Previous review"
            disabled={flipping}
          >
            ‹
          </button>
        )}

        <div className="agency-review-flip__stage">
          <article
            className={`agency-review-flip__card${
              flipPhase === "out" ? " is-flip-out" : flipPhase === "in" ? " is-flip-in" : ""
            }`}
          >
            <div className="agency-review-flip__rating">
              <span className="agency-review-flip__rating-num">{review.rating.toFixed(1)}</span>
              <span
                className="agency-review-flip__stars"
                aria-label={`${review.rating} out of 5 stars`}
              >
                {starString(review.rating)}
              </span>
            </div>
            {review.body && <p className="agency-review-flip__body">&ldquo;{review.body}&rdquo;</p>}
            <footer className="agency-review-flip__author">— {review.authorName}</footer>
          </article>
        </div>

        {hasMultiple && (
          <button
            type="button"
            className="agency-review-flip__nav agency-review-flip__nav--next"
            onClick={() => goTo(index + 1)}
            aria-label="Next review"
            disabled={flipping}
          >
            ›
          </button>
        )}
      </div>

      {hasMultiple && (
        <div className="agency-review-flip__dots" role="tablist" aria-label="Reviews">
          {reviews.map((r, i) => (
            <button
              key={`${r.authorName}-${i}`}
              type="button"
              role="tab"
              className={`agency-review-flip__dot${i === index ? " is-active" : ""}`}
              aria-selected={i === index}
              aria-label={`Review ${i + 1}`}
              onClick={() => goTo(i)}
              disabled={flipping}
            />
          ))}
        </div>
      )}
    </div>
  );
}
