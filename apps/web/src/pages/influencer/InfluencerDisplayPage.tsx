import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import { InfluencerTourDetailModal } from "../../components/influencer/InfluencerTourDetailModal";
import { useInfluencerDashboard, type InfluencerTour } from "./types";

type DisplayTour = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  days: number;
  publicPriceLkr: number;
  influencerCommissionLkr: number;
  coverUrl: string | null;
  agency: { id: string; name: string; slug: string };
  hasReferralCode: boolean;
  referralCode: string | null;
};

type DisplayData = {
  slug: string;
  publicPath: string;
  display: { headline: string; tagline: string; tourIds: string[] };
  availableTours: DisplayTour[];
};

export function InfluencerDisplayPage() {
  const { token } = useAuth();
  const { openCreateForTour, copyText } = useInfluencerDashboard();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [slug, setSlug] = useState("");
  const [headline, setHeadline] = useState("");
  const [tagline, setTagline] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [tours, setTours] = useState<DisplayTour[]>([]);
  const [agencyFilter, setAgencyFilter] = useState("all");
  const [detailTour, setDetailTour] = useState<InfluencerTour | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api<DisplayData>("/influencer/mine/display", { token });
      setSlug(data.slug);
      setHeadline(data.display.headline);
      setTagline(data.display.tagline);
      setSelectedIds(new Set(data.display.tourIds));
      setTours(data.availableTours);
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Failed to load display settings");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const agencies = useMemo(() => {
    const map = new Map<string, string>();
    tours.forEach((t) => map.set(t.agency.id, t.agency.name));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [tours]);

  const filteredTours = useMemo(() => {
    if (agencyFilter === "all") return tours;
    return tours.filter((t) => t.agency.id === agencyFilter);
  }, [tours, agencyFilter]);

  function toggleTour(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setMsg("");
    try {
      const tourIds = tours.filter((t) => selectedIds.has(t.id)).map((t) => t.id);
      await api("/influencer/mine/display", {
        method: "PUT",
        token,
        body: JSON.stringify({ headline, tagline, tourIds }),
      });
      setMsg("Display page saved.");
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const storefrontUrl =
    typeof window !== "undefined" && slug ? `${window.location.origin}/influencers/${slug}` : "";

  async function copyStorefrontLink() {
    if (!storefrontUrl) return;
    try {
      await navigator.clipboard.writeText(storefrontUrl);
      setMsg("Public link copied to clipboard.");
    } catch {
      setMsg("Could not copy link. Select the URL and copy manually.");
    }
  }

  async function shareStorefront() {
    if (!storefrontUrl) return;
    setMsg("");
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({
          title: headline.trim() || "My tour picks",
          text: tagline.trim() || "Sri Lanka tours I recommend",
          url: storefrontUrl,
        });
        setMsg("Share sent.");
      } else {
        await copyStorefrontLink();
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      await copyStorefrontLink();
    }
  }

  return (
    <div className="module-shell module-partner">
      <ModuleHeader
        module="partner"
        title="Display page"
        subtitle="Choose tours to feature on your public page. Visitors can open packages with your referral link when you have a code."
      >
        {slug && (
          <>
            <button type="button" className="btn btn-primary" onClick={() => void shareStorefront()}>
              Share page
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => void copyStorefrontLink()}>
              Copy link
            </button>
            <Link to={`/influencers/${slug}`} className="btn btn-teal" target="_blank" rel="noreferrer">
              Preview
            </Link>
          </>
        )}
      </ModuleHeader>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <form className="influencer-display-editor" onSubmit={save}>
          {storefrontUrl && (
            <div className="influencer-display-url">
              <div className="influencer-display-url-top">
                <span className="muted">Public link — share with your audience</span>
                <div className="influencer-display-url-actions">
                  <button type="button" className="btn btn-primary" onClick={() => void shareStorefront()}>
                    Share
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => void copyStorefrontLink()}>
                    Copy link
                  </button>
                </div>
              </div>
              <code>{storefrontUrl}</code>
            </div>
          )}

          <label className="field">
            <span>Headline</span>
            <input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="My Sri Lanka picks"
              required
            />
          </label>

          <label className="field">
            <span>Short intro</span>
            <textarea
              rows={2}
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="A line about what you recommend"
            />
          </label>

          <div className="partner-toolbar">
            <label className="partner-filter">
              <span className="muted">Filter by agency</span>
              <select value={agencyFilter} onChange={(e) => setAgencyFilter(e.target.value)}>
                <option value="all">All agencies</option>
                {agencies.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <span className="muted">{selectedIds.size} selected</span>
          </div>

          <ul className="influencer-display-tour-list">
            {filteredTours.length === 0 ? (
              <li className="muted">No tours match this filter.</li>
            ) : (
              filteredTours.map((t) => {
                const checked = selectedIds.has(t.id);
                return (
                  <li key={t.id}>
                    <label
                      className={`influencer-display-tour-row${checked ? " influencer-display-tour-row--on" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTour(t.id)}
                      />
                      <span className="influencer-display-tour-main">
                        <strong>{t.title}</strong>
                        <span className="muted">
                          {t.agency.name} · {t.days} days · LKR {t.publicPriceLkr.toLocaleString()}
                          {t.influencerCommissionLkr > 0 &&
                            ` · you earn LKR ${t.influencerCommissionLkr.toLocaleString()}`}
                        </span>
                      </span>
                      <span className="influencer-display-tour-side">
                        {t.hasReferralCode ? (
                          <span className="influencer-display-ref ok">Code {t.referralCode}</span>
                        ) : (
                          <span className="influencer-display-ref muted">No code yet</span>
                        )}
                        <button
                          type="button"
                          className="btn btn-ghost btn-nav influencer-display-info-btn"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDetailTour({
                              id: t.id,
                              title: t.title,
                              slug: t.slug,
                              summary: t.summary,
                              days: t.days,
                              basePriceLkr: t.publicPriceLkr,
                              influencerCommissionLkr: t.influencerCommissionLkr,
                              publicPriceLkr: t.publicPriceLkr,
                              coverUrl: t.coverUrl,
                              seasonTag: null,
                              agency: t.agency,
                            });
                          }}
                        >
                          Agency info
                        </button>
                      </span>
                    </label>
                  </li>
                );
              })
            )}
          </ul>

          <div className="dialog-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Save display page"}
            </button>
          </div>

          {msg && <p className="partner-toast">{msg}</p>}
        </form>
      )}

      <InfluencerTourDetailModal
        tour={detailTour}
        open={!!detailTour}
        onClose={() => setDetailTour(null)}
        onCreate={() => {
          if (detailTour) {
            setDetailTour(null);
            openCreateForTour(detailTour.id);
          }
        }}
        onCopy={copyText}
      />
    </div>
  );
}
