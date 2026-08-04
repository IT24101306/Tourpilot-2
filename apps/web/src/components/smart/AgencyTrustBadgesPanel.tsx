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

  return (
    <section className="agency-trust-panel" aria-label="Trust signals">
      <header>
        <h3>Trust signals</h3>
        <p className="muted">
          Earn badges travelers see on your storefront
          {loading ? "…" : ` · ${earnedCount} of ${badges.length} unlocked`}.
        </p>
      </header>
      {loading ? (
        <p className="muted">Checking your progress…</p>
      ) : (
        <TrustBadgeRow badges={badges} showProgress />
      )}
    </section>
  );
}
