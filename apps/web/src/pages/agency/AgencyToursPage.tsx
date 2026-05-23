import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { AgencyTour } from "./types";

export function AgencyToursPage() {
  const { token } = useAuth();
  const [tours, setTours] = useState<AgencyTour[]>([]);
  const [tab, setTab] = useState<"ready" | "custom">("ready");

  useEffect(() => {
    if (!token) return;
    api<AgencyTour[]>("/tours/agency/mine", { token }).then(setTours);
  }, [token]);

  const published = tours.filter((t) => t.isPublished);
  const drafts = tours.filter((t) => !t.isPublished);
  const visible = tab === "ready" ? published : drafts;

  return (
    <>
      <div className="agency-panel-head">
        <h2>Tours</h2>
        <p>Manage schedule, guides, and route readiness.</p>
      </div>

      <div className="agency-sub-tabs">
        <button
          type="button"
          className={`agency-sub-tab${tab === "ready" ? " active" : ""}`}
          onClick={() => setTab("ready")}
        >
          Ready-Made Tours
        </button>
        <button
          type="button"
          className={`agency-sub-tab${tab === "custom" ? " active" : ""}`}
          onClick={() => setTab("custom")}
        >
          Draft Tours
        </button>
      </div>

      {visible.length === 0 && (
        <p className="muted">No {tab === "ready" ? "published" : "draft"} tours yet.</p>
      )}
      <div className="agency-list">
        {visible.map((t) => (
          <div key={t.id} className="agency-list-item">
            <span>
              {t.title} · {t.days} days · LKR {t.basePriceLkr.toLocaleString()}
            </span>
            <span className={`agency-status ${t.isPublished ? "ok" : "warn"}`}>
              {t.isPublished ? "Published" : "Draft"}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
