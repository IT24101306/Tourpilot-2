import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatOfferMonthLabel } from "@tourpilot/shared";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { ModuleHeader } from "../../components/module/ModuleHeader";
import { InfluencerTourPickModal, type InfluencerDisplayTourOption } from "../../components/influencer/InfluencerTourPickModal";
import type { InfluencerTourDisplaySettings } from "../../lib/influencerDisplay";
import { InfluencerDisplayContentEditor } from "../../components/influencer/InfluencerDisplayContentEditor";
import type { DisplaySocialLink, HeroSlide } from "../../components/display/displayTypes";
import { isFreeOffer } from "../../lib/offerPricing";
import "../../styles/dashboard.css";

type DisplayTour = InfluencerDisplayTourOption & {
  summary: string | null;
  coverUrl: string | null;
  hasReferralCode: boolean;
  referralCode: string | null;
};

type DisplayOffer = {
  id: string;
  title: string;
  description: string | null;
  rewardText: string;
  offerMonth?: string | null;
  tourPriceLkr: number;
  discountedLkr: number | null;
  spotsLeft: number;
  registeredCount?: number;
  validUntil: string;
  agency?: { id: string; name: string; slug: string } | null;
  agencyName?: string | null;
};

type DisplayData = {
  slug: string;
  publicPath: string;
  display: {
    headline: string;
    tagline: string;
    tourIds: string[];
    offerIds: string[];
    heroImages: HeroSlide[];
    aboutTitle: string;
    aboutDescription: string;
    socialLinks: DisplaySocialLink[];
    tourSettings?: Record<string, InfluencerTourDisplaySettings>;
  };
  availableTours: DisplayTour[];
  availableOffers: DisplayOffer[];
};

export function InfluencerDisplayPage() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [slug, setSlug] = useState("");
  const [headline, setHeadline] = useState("");
  const [tagline, setTagline] = useState("");
  const [heroImages, setHeroImages] = useState<HeroSlide[]>([]);
  const [aboutTitle, setAboutTitle] = useState("About the creator");
  const [aboutDescription, setAboutDescription] = useState("");
  const [socialLinks, setSocialLinks] = useState<DisplaySocialLink[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedOfferIds, setSelectedOfferIds] = useState<Set<string>>(new Set());
  const [tourSettings, setTourSettings] = useState<Record<string, InfluencerTourDisplaySettings>>({});
  const [tours, setTours] = useState<DisplayTour[]>([]);
  const [offers, setOffers] = useState<DisplayOffer[]>([]);
  const [agencyFilter, setAgencyFilter] = useState("all");
  const [pickTour, setPickTour] = useState<DisplayTour | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api<DisplayData>("/influencer/mine/display", { token });
      setSlug(data.slug);
      setHeadline(data.display.headline);
      setTagline(data.display.tagline);
      setHeroImages(data.display.heroImages ?? []);
      setAboutTitle(data.display.aboutTitle ?? "About the creator");
      setAboutDescription(data.display.aboutDescription ?? "");
      setSocialLinks(data.display.socialLinks ?? []);
      setSelectedIds(new Set(data.display.tourIds));
      setSelectedOfferIds(new Set(data.display.offerIds ?? []));
      setTourSettings(data.display.tourSettings ?? {});
      setTours(data.availableTours);
      setOffers(data.availableOffers ?? []);
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
    offers.forEach((o) => {
      if (o.agency) map.set(o.agency.id, o.agency.name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [tours, offers]);

  const filteredTours = useMemo(() => {
    if (agencyFilter === "all") return tours;
    return tours.filter((t) => t.agency.id === agencyFilter);
  }, [tours, agencyFilter]);

  const filteredOffers = useMemo(() => {
    if (agencyFilter === "all") return offers;
    return offers.filter((o) => o.agency?.id === agencyFilter);
  }, [offers, agencyFilter]);

  function offerAgencyName(o: DisplayOffer) {
    return o.agency?.name ?? o.agencyName ?? "Agency";
  }

  function offerPriceLabel(o: DisplayOffer) {
    if (isFreeOffer(o.discountedLkr)) return "FREE tour";
    if (o.discountedLkr != null) {
      return `LKR ${o.discountedLkr.toLocaleString()} (was ${o.tourPriceLkr.toLocaleString()})`;
    }
    return `from LKR ${o.tourPriceLkr.toLocaleString()}`;
  }

  function openTourPicker(tour: DisplayTour) {
    setPickTour(tour);
  }

  function confirmTourPick(settings: InfluencerTourDisplaySettings) {
    if (!pickTour) return;
    setSelectedIds((prev) => new Set(prev).add(pickTour.id));
    setTourSettings((prev) => ({ ...prev, [pickTour.id]: settings }));
    setPickTour(null);
  }

  function removeTourFromDisplay(tourId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(tourId);
      return next;
    });
    setTourSettings((prev) => {
      const next = { ...prev };
      delete next[tourId];
      return next;
    });
  }

  function toggleOffer(id: string) {
    setSelectedOfferIds((prev) => {
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
      const offerIds = offers.filter((o) => selectedOfferIds.has(o.id)).map((o) => o.id);
      const settingsPayload: Record<string, InfluencerTourDisplaySettings> = {};
      for (const id of tourIds) {
        if (tourSettings[id]?.termsAcceptedAt) settingsPayload[id] = tourSettings[id];
      }
      await api("/influencer/mine/display", {
        method: "PUT",
        token,
        body: JSON.stringify({
          headline,
          tagline,
          tourIds,
          offerIds,
          heroImages,
          aboutTitle,
          aboutDescription,
          socialLinks,
          tourSettings: settingsPayload,
        }),
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
        subtitle="Choose tours and agency offers to feature on your public page. Visitors can book tours with your referral link or register for special offers."
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

          <InfluencerDisplayContentEditor
            token={token}
            heroImages={heroImages}
            aboutTitle={aboutTitle}
            aboutDescription={aboutDescription}
            socialLinks={socialLinks}
            onHeroImagesChange={setHeroImages}
            onAboutTitleChange={setAboutTitle}
            onAboutDescriptionChange={setAboutDescription}
            onSocialLinksChange={setSocialLinks}
          />

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
            <span className="muted">
              {selectedIds.size} tour{selectedIds.size === 1 ? "" : "s"} · {selectedOfferIds.size} offer
              {selectedOfferIds.size === 1 ? "" : "s"}
            </span>
          </div>

          <h3 className="influencer-display-section-title">Tours</h3>
          <ul className="influencer-display-tour-list">
            {filteredTours.length === 0 ? (
              <li className="muted">No tours match this filter.</li>
            ) : (
              filteredTours.map((t) => {
                const checked = selectedIds.has(t.id);
                const settings = tourSettings[t.id];
                const shownPrice = settings?.displayPriceLkr ?? t.publicPriceLkr;
                return (
                  <li key={t.id}>
                    <div
                      className={`influencer-display-tour-row${checked ? " influencer-display-tour-row--on" : ""}`}
                    >
                      <span className="influencer-display-tour-main">
                        <strong>{t.title}</strong>
                        <span className="muted">
                          {settings?.hideAgencyName ? "Agency hidden" : t.agency.name} · {t.days} days ·
                          LKR {shownPrice.toLocaleString()}
                          {` · ${t.influencerCommissionPct}% commission (LKR ${t.influencerCommissionLkr.toLocaleString()})`}
                        </span>
                      </span>
                      <span className="influencer-display-tour-side">
                        {t.hasReferralCode ? (
                          <span className="influencer-display-ref ok">Code {t.referralCode}</span>
                        ) : (
                          <span className="influencer-display-ref muted">No code yet</span>
                        )}
                        {checked ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-ghost btn-nav influencer-display-info-btn"
                              onClick={() => openTourPicker(t)}
                            >
                              Edit options
                            </button>
                            <button
                              type="button"
                              className="btn btn-lite btn-nav"
                              onClick={() => removeTourFromDisplay(t.id)}
                            >
                              Remove
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-primary btn-nav"
                            onClick={() => openTourPicker(t)}
                          >
                            Add to page
                          </button>
                        )}
                      </span>
                    </div>
                  </li>
                );
              })
            )}
          </ul>

          <h3 className="influencer-display-section-title">Agency offers</h3>
          <p className="muted influencer-display-section-hint">
            Active limited-time offers from travel agencies. Featured offers appear on your public page
            so followers can register.
          </p>
          <ul className="influencer-display-tour-list">
            {filteredOffers.length === 0 ? (
              <li className="muted" style={{ padding: "12px 14px" }}>
                No active agency offers match this filter.
              </li>
            ) : (
              filteredOffers.map((o) => {
                const checked = selectedOfferIds.has(o.id);
                const monthLabel = formatOfferMonthLabel(o.offerMonth);
                return (
                  <li key={o.id}>
                    <label
                      className={`influencer-display-tour-row${checked ? " influencer-display-tour-row--on" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOffer(o.id)}
                      />
                      <span className="influencer-display-tour-main">
                        <strong>{o.title}</strong>
                        <span className="muted">
                          {offerAgencyName(o)}
                          {monthLabel ? ` · ${monthLabel}` : ""} · {offerPriceLabel(o)}
                        </span>
                        <span className="muted">{o.rewardText}</span>
                      </span>
                      <span className="influencer-display-tour-side">
                        <span className="influencer-display-ref ok">
                          {o.spotsLeft === 0 ? "Full" : `${o.spotsLeft} spots left`}
                        </span>
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

      <InfluencerTourPickModal
        open={!!pickTour}
        tour={pickTour}
        settings={pickTour ? tourSettings[pickTour.id] ?? {} : {}}
        token={token}
        isEditing={pickTour ? selectedIds.has(pickTour.id) : false}
        onClose={() => setPickTour(null)}
        onConfirm={confirmTourPick}
        onCommissionRequestSent={() => void load()}
      />
    </div>
  );
}
