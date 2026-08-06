import { useEffect, useState } from "react";
import type { EarnedTrustBadge } from "@tourpilot/shared";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { TrustBadgeRow } from "../smart/TrustBadgeRow";

/** Agency dashboard panel — earned + in-progress trust signals. */
export function AgencyTrustBadgesPanel() {
  const { token } = useAuth();
  const [badges, setBadges] = useState<EarnedTrustBadge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api<{ badges: EarnedTrustBadge[] }>("/smart/agencies/mine/trust-badges", { token })
      .then((res) => setBadges(res.badges ?? []))
      .catch(() => setBadges([]))
      .finally(() => setLoading(false));
  }, [token]);

  const earnedCount = badges.filter((b) => b.earned).length;
  const total = badges.length;
  const pct = total > 0 ? Math.round((earnedCount / total) * 100) : 0;

  return (
    <section className="agency-trust-panel" aria-label="Trust signals">
      <header className="agency-trust-panel__head">
        <h3>Trust signals</h3>
        {!loading && total > 0 ? (
          <div className="agency-trust-panel__meter" aria-label={`${earnedCount} of ${total} unlocked`}>
            <strong>
              {earnedCount}/{total}
            </strong>
            <span>unlocked</span>
            <div className="agency-trust-panel__bar" aria-hidden="true">
              <span style={{ width: `${pct}%` }} />
            </div>
          </div>
        ) : null}
      </header>
      {loading ? (
        <p className="muted">Checking your progress…</p>
      ) : (
        <TrustBadgeRow badges={badges} showProgress />
      )}
    </section>
  );
}
