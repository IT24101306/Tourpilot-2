import { useEffect, useState } from "react";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import { EmptyState } from "../../components/feedback/EmptyState";

type TouristReviewRow = {
  id: string;
  rating: number;
  body: string | null;
  isPublic: boolean;
  createdAt: string;
  tourist: { id: string; name: string };
  inquiry: { id: string; tour: { id: string; title: string } | null };
};

export function AgencyReviewsPage() {
  const { token } = useAuth();
  const [reviews, setReviews] = useState<TouristReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api<TouristReviewRow[]>("/reviews/agency/mine", { token })
      .then(setReviews)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  async function toggleVisibility(reviewId: string, isPublic: boolean) {
    if (!token) return;
    setToggling(reviewId);
    try {
      await api(`/reviews/agency/mine/${reviewId}/visibility`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ isPublic }),
      });
      setReviews((prev) =>
        prev.map((r) => (r.id === reviewId ? { ...r, isPublic } : r))
      );
    } catch (err) {
      console.error(err instanceof ApiError ? err.message : err);
    } finally {
      setToggling(null);
    }
  }

  const publicCount = reviews.filter((r) => r.isPublic).length;

  return (
    <div className="module-shell module-operations">
      <ModuleHeader
        module="operations"
        title="Tourist reviews"
        subtitle="Real feedback from travelers — toggle visibility to show on your public page."
      />

      {loading ? (
        <p className="muted">Loading reviews…</p>
      ) : reviews.length === 0 ? (
        <EmptyState
          title="No tourist reviews yet"
          description="Reviews appear here after travelers complete their trips and submit feedback."
        />
      ) : (
        <>
          <p className="muted" style={{ margin: "0 0 16px" }}>
            {reviews.length} review{reviews.length === 1 ? "" : "s"} total · {publicCount} visible
            on your public page
          </p>
          <ul className="agency-reviews-list">
            {reviews.map((review) => (
              <li key={review.id} className="agency-review-card">
                <div className="agency-review-card__head">
                  <div>
                    <strong>{review.tourist.name}</strong>
                    <span className="muted">
                      {" · "}
                      {review.inquiry.tour?.title ?? "Custom trip"}
                      {" · "}
                      {new Date(review.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <span className="agency-review-card__stars">
                    {"★".repeat(review.rating)}
                    {"☆".repeat(5 - review.rating)}
                  </span>
                </div>
                {review.body && (
                  <p className="agency-review-card__body">{review.body}</p>
                )}
                <div className="agency-review-card__actions">
                  <label className="agency-review-toggle">
                    <input
                      type="checkbox"
                      checked={review.isPublic}
                      disabled={toggling === review.id}
                      onChange={(e) => toggleVisibility(review.id, e.target.checked)}
                    />
                    <span>{review.isPublic ? "Visible on public page" : "Hidden from public"}</span>
                  </label>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
