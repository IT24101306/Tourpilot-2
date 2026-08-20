import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { dashboardPathForRole } from "@tourpilot/shared";
import { api } from "../api/client";
import { AccountProfileShell } from "../components/account/AccountProfileShell";
import { AccountProfileStepNav } from "../components/account/AccountProfileStepNav";
import type {
  AccountAction,
  AccountField,
  AccountHighlight,
  AccountStat,
} from "../components/account/accountProfileUtils";
import { AgencyLogoPanel } from "../components/account/AgencyLogoPanel";
import { CurrencyPreferencePanel } from "../components/account/CurrencyPreferencePanel";
import { WalletHistoryPanel } from "../components/account/WalletHistoryPanel";
import { lkr, roleLabel } from "../components/account/accountProfileUtils";
import { agencyFeaturesOf, useAuth } from "../context/AuthContext";
import { usePublicSmartFeatures } from "../lib/publicSmartFeatures";
import { TouristSavedPage } from "./TouristSavedPage";
import type { InfluencerDashboardData } from "./influencer/types";

type InquirySummary = {
  id: string;
  status: string;
  agency?: { id: string; name: string; slug: string; logoUrl?: string | null } | null;
  handlerInfluencer?: { id: string; name: string; slug: string | null } | null;
  whiteLabel?: boolean;
};

const TOURIST_STEPS = [
  { id: "inquiries", label: "Inquiries", hint: "Open & pending requests" },
  { id: "bookings", label: "Bookings", hint: "Confirmed & active trips" },
  { id: "wallet", label: "Wallet", hint: "Balance, top up & history" },
  { id: "featured", label: "Featured", hint: "Travel hub & glance stats" },
  { id: "favourite", label: "Favourite", hint: "Your saved tours" },
  { id: "currency", label: "Display currency", hint: "How prices appear" },
] as const;

type TouristStepId = (typeof TOURIST_STEPS)[number]["id"];

const TOURIST_STEP_IDS = new Set<string>(TOURIST_STEPS.map((s) => s.id));

function isTouristStep(value: string | null): value is TouristStepId {
  return Boolean(value && TOURIST_STEP_IDS.has(value));
}

const BOOKING_STATUSES = new Set(["ACCEPTED", "IN_PROGRESS", "COMPLETED"]);

function statusLabel(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function partnerName(inquiry: InquirySummary): string {
  if (inquiry.whiteLabel && inquiry.handlerInfluencer?.name) {
    return inquiry.handlerInfluencer.name;
  }
  return inquiry.agency?.name ?? "Travel partner";
}

export function ProfilePage() {
  const { user, token } = useAuth();
  const { publicOffersEnabled } = usePublicSmartFeatures();
  const [searchParams, setSearchParams] = useSearchParams();
  const [inquiries, setInquiries] = useState<InquirySummary[]>([]);
  const [savedCount, setSavedCount] = useState(0);
  const [partner, setPartner] = useState<InfluencerDashboardData | null>(null);
  const [loadingExtra, setLoadingExtra] = useState(false);
  const [loadError, setLoadError] = useState("");

  const sectionParam = searchParams.get("section");
  const activeStep: TouristStepId = isTouristStep(sectionParam) ? sectionParam : "inquiries";

  const setActiveStep = useCallback(
    (id: TouristStepId) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (id === "inquiries") next.delete("section");
          else next.set("section", id);
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const loadInquiries = useCallback(async () => {
    if (!token || user?.role !== "TOURIST") return;
    setLoadError("");
    try {
      const list = await api<InquirySummary[]>("/inquiries/mine", { token });
      setInquiries(list);
    } catch (err) {
      setInquiries([]);
      setLoadError(err instanceof Error ? err.message : "Could not load your inquiries");
    }
  }, [token, user?.role]);

  const loadSavedCount = useCallback(async () => {
    if (!token || user?.role !== "TOURIST") return;
    try {
      const tours = await api<{ id: string }[]>("/saved-tours/mine", { token });
      setSavedCount(tours.length);
    } catch {
      setSavedCount(0);
    }
  }, [token, user?.role]);

  const loadPartner = useCallback(async () => {
    if (!token || user?.role !== "INFLUENCER") return;
    const data = await api<InfluencerDashboardData>("/influencer/dashboard", { token });
    setPartner(data);
  }, [token, user?.role]);

  useEffect(() => {
    if (!user || !token) return;
    setLoadingExtra(true);
    Promise.all([loadInquiries(), loadSavedCount(), loadPartner()]).finally(() =>
      setLoadingExtra(false)
    );
  }, [user, token, loadInquiries, loadSavedCount, loadPartner]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#account-favourites-title") {
      setActiveStep("favourite");
    }
  }, [setActiveStep]);

  const bookings = inquiries.filter((i) => BOOKING_STATUSES.has(i.status));
  const openInquiries = inquiries.filter((i) => !BOOKING_STATUSES.has(i.status));

  if (!user) {
    return (
      <section className="section account-profile">
        <p>
          Please <Link to="/login">log in</Link>.
        </p>
      </section>
    );
  }

  const profileUser = user;

  const stats: AccountStat[] = [];
  const fields: AccountField[] = [];
  const actions: AccountAction[] = [];
  const highlights: AccountHighlight[] = [];
  let tagline: string | null = null;
  let contextLabel: string | null = null;
  let contextPartners: { name: string; slug?: string | null; logoUrl?: string | null; href?: string }[] =
    [];

  const dashPath = dashboardPathForRole(profileUser.role);
  if (profileUser.role !== "TOURIST" && dashPath !== "/profile") {
    actions.push({
      label: `${roleLabel(profileUser.role)} dashboard`,
      to: dashPath,
      variant: "primary",
    });
  }

  switch (profileUser.role) {
    case "TOURIST": {
      const loyalty = profileUser.touristProfile?.loyaltyPoints ?? 0;
      const inquiryCount = inquiries.length;
      const bookingCount = inquiries.filter((i) => BOOKING_STATUSES.has(i.status)).length;

      const partnerMap = new Map<
        string,
        { name: string; slug?: string | null; logoUrl?: string | null; href?: string }
      >();
      for (const inquiry of inquiries) {
        if (inquiry.whiteLabel && inquiry.handlerInfluencer?.name) {
          const key = `i:${inquiry.handlerInfluencer.id}`;
          if (!partnerMap.has(key)) {
            partnerMap.set(key, {
              name: inquiry.handlerInfluencer.name,
              slug: inquiry.handlerInfluencer.slug,
              href: inquiry.handlerInfluencer.slug
                ? `/i/${inquiry.handlerInfluencer.slug}`
                : `/trips/${inquiry.id}`,
            });
          }
          continue;
        }
        if (inquiry.agency) {
          const key = `a:${inquiry.agency.id}`;
          if (!partnerMap.has(key)) {
            partnerMap.set(key, {
              name: inquiry.agency.name,
              slug: inquiry.agency.slug,
              logoUrl: inquiry.agency.logoUrl,
              href: `/agencies/${inquiry.agency.slug}`,
            });
          }
        }
      }
      contextPartners = Array.from(partnerMap.values()).slice(0, 4);
      contextLabel =
        contextPartners.length === 1
          ? `Planning with ${contextPartners[0]!.name}`
          : contextPartners.length > 1
            ? `Planning with ${contextPartners.length} partners`
            : "Traveler account";

      highlights.push({
        id: "journey",
        label: inquiryCount > 0 ? "Your travel hub" : "Start your Sri Lanka journey",
        value:
          inquiryCount > 0
            ? `${inquiryCount} inquir${inquiryCount === 1 ? "y" : "ies"} · ${bookingCount} booking${bookingCount === 1 ? "" : "s"}`
            : "Plan your first trip",
        description:
          inquiryCount > 0
            ? "Track inquiries, bookings, and saved tours."
            : "Send inquiries, save tours, and manage bookings.",
        to: "/trips",
      });

      stats.push(
        { label: "Inquiries", value: String(inquiryCount), tone: "accent" },
        { label: "Bookings", value: String(bookingCount) },
        { label: "Saved", value: String(savedCount) },
        { label: "Loyalty points", value: loyalty.toLocaleString() }
      );
      break;
    }
    case "INFLUENCER": {
      contextLabel = "Partner workspace";
      contextPartners = [{ name: user.name, href: "/dashboard/i" }];
      if (partner) {
        tagline = partner.profile.bio;
        highlights.push({
          id: "growth",
          label: "Partner growth",
          value: lkr(partner.stats.totalEarned),
          description: `${partner.stats.activeCodes} active codes · ${partner.stats.totalClicks.toLocaleString()} clicks`,
          to: "/dashboard/i",
        });
        stats.push(
          { label: "Pending", value: lkr(partner.stats.pendingCommission) },
          { label: "Active codes", value: String(partner.stats.activeCodes), tone: "accent" },
          { label: "Total codes", value: String(partner.codes.length) }
        );
      } else if (loadingExtra) {
        highlights.push({
          id: "loading",
          label: "Partner account",
          value: "Loading stats…",
          description: "Fetching your codes and commissions.",
          to: "/dashboard/i",
        });
      }
      actions.push(
        { label: "Referral codes", to: "/dashboard/i/codes", variant: "teal" },
        { label: "Commissions", to: "/dashboard/i/commissions" },
        { label: "Tours to promote", to: "/dashboard/i/tours" }
      );
      break;
    }
    case "AGENCY": {
      if (user.agency) {
        const isStaff = user.agencyMembership === "staff";
        contextLabel = isStaff
          ? `${user.agency.name} · Staff`
          : `${user.agency.name} · Agency dashboard`;
        tagline = isStaff
          ? user.staffTitle
            ? `You help manage this agency as ${user.staffTitle}.`
            : "You help manage this agency workspace."
          : "You are managing this agency workspace.";
        contextPartners = [
          {
            name: user.agency.name,
            slug: user.agency.slug,
            logoUrl: user.agency.logoUrl,
            href: `/agencies/${user.agency.slug}`,
          },
        ];
        highlights.push({
          id: "storefront",
          label: "Public storefront",
          value: user.agency.name,
          description: "Packages, gallery, and inquiry form for travelers.",
          to: `/agencies/${user.agency.slug}`,
        });
        if (!isStaff) {
          highlights.push({
            id: "billing",
            label: "Subscription",
            value: user.trial?.packageName || "Billing",
            description: user.trial?.active
              ? `Trial · ${user.trial.daysRemaining ?? "?"} day(s) left`
              : user.trial?.priceLabel || "Manage plan, payments, and credits",
            to: "/profile/billing/subscriptions",
            span: 1,
          });
        }
        fields.push({
          label: "Store URL",
          value: `srilankatourpilot.com/agencies/${user.agency.slug}`,
        });
      } else {
        contextLabel = "Agency account";
      }
      {
        const features = agencyFeaturesOf(user);
        const isStaff = user.agencyMembership === "staff";
        if (features.readyMadeTours) {
          actions.push({ label: "Manage tours", to: "/dashboard/agency/tours", variant: "teal" });
        }
        if (features.negotiationsBookings) {
          actions.push(
            { label: "Bookings", to: "/dashboard/agency/bookings" },
            { label: "Negotiations", to: "/dashboard/agency/negotiations" }
          );
        }
        if (features.offers) {
          actions.push({ label: "Offers", to: "/dashboard/agency/offers" });
        }
        if (!isStaff) {
          actions.push({
            label: "Manage subscription",
            to: "/profile/billing/subscriptions",
            variant: "ghost",
          });
          actions.push({ label: "Team", to: "/dashboard/agency/team", variant: "ghost" });
        }
      }
      break;
    }
    case "DRIVER": {
      if (user.agencyDriver) {
        contextLabel = `Driver for ${user.agencyDriver.agencyName}`;
        contextPartners = [
          {
            name: user.agencyDriver.agencyName,
            slug: user.agencyDriver.agencySlug,
            href: `/agencies/${user.agencyDriver.agencySlug}`,
          },
        ];
      } else {
        contextLabel = "Driver account";
      }
      highlights.push({
        id: "schedule",
        label: "Today on the road",
        value: user.agencyDriver?.agencyName ?? "Your schedule",
        description: user.agencyDriver
          ? `Linked to ${user.agencyDriver.agencyName} · ${user.agencyDriver.status}`
          : "Pickups, routes, and assigned tours.",
        to: "/dashboard/driver",
      });
      actions.push(
        { label: "Today's schedule", to: "/dashboard/driver", variant: "teal" },
        { label: "Assigned tours", to: "/dashboard/driver/assigned" },
        { label: "Edit driver profile", to: "/dashboard/driver/profile" }
      );
      break;
    }
    case "ADMIN": {
      contextLabel = "TourPilot platform admin";
      highlights.push({
        id: "governance",
        label: "Platform oversight",
        value: "Approvals & offers",
        description: "Review agencies and manage platform offers.",
        to: "/dashboard/admin",
      });
      actions.push(
        { label: "Admin overview", to: "/dashboard/admin", variant: "teal" },
        { label: "Manage offers", to: "/dashboard/admin/offers" },
        { label: "Public site", to: "/" }
      );
      break;
    }
  }

  const isTourist = user.role === "TOURIST";
  const featured = highlights[0] ?? null;

  function renderTouristPanel() {
    switch (activeStep) {
      case "inquiries":
        return (
          <section className="account-profile-panel" aria-labelledby="account-inquiries-title">
            <header className="account-block-head">
              <h2 id="account-inquiries-title">Inquiries</h2>
              <p className="muted">Requests still in negotiation or waiting on a reply.</p>
            </header>
            {loadError ? <p className="form-error">{loadError}</p> : null}
            {loadingExtra ? <p className="muted">Refreshing your travel activity…</p> : null}
            {openInquiries.length === 0 ? (
              <p className="muted account-profile-panel__empty">
                No open inquiries.{" "}
                {publicOffersEnabled ? (
                  <>
                    <Link to="/offers">Browse offers</Link> or open your{" "}
                    <Link to="/trips">travel hub</Link>.
                  </>
                ) : (
                  <>
                    Open your <Link to="/trips">travel hub</Link>.
                  </>
                )}
              </p>
            ) : (
              <ul className="account-profile-list">
                {openInquiries.map((inquiry) => (
                  <li key={inquiry.id}>
                    <Link to={`/trips/${inquiry.id}`} className="account-profile-list__item">
                      <span className="account-profile-list__title">{partnerName(inquiry)}</span>
                      <span className="account-profile-list__meta">{statusLabel(inquiry.status)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <p className="account-profile-panel__footer">
              <Link to="/trips" className="btn btn-teal">
                Open travel hub
              </Link>
            </p>
          </section>
        );
      case "bookings":
        return (
          <section className="account-profile-panel" aria-labelledby="account-bookings-title">
            <header className="account-block-head">
              <h2 id="account-bookings-title">Bookings</h2>
              <p className="muted">Confirmed, in-progress, and completed trips.</p>
            </header>
            {bookings.length === 0 ? (
              <p className="muted account-profile-panel__empty">
                No bookings yet. Accept a proposal from an inquiry to see it here.
              </p>
            ) : (
              <ul className="account-profile-list">
                {bookings.map((inquiry) => (
                  <li key={inquiry.id}>
                    <Link to={`/trips/${inquiry.id}`} className="account-profile-list__item">
                      <span className="account-profile-list__title">{partnerName(inquiry)}</span>
                      <span className="account-profile-list__meta">{statusLabel(inquiry.status)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <p className="account-profile-panel__footer">
              <Link to="/trips?tab=bookings" className="btn btn-teal">
                View all bookings
              </Link>
            </p>
          </section>
        );
      case "wallet":
        return <WalletHistoryPanel />;
      case "featured":
        return (
          <section className="account-profile-panel" aria-labelledby="account-featured-title">
            <header className="account-block-head">
              <h2 id="account-featured-title">Featured</h2>
              <p className="muted">Your travel hub snapshot and account overview.</p>
            </header>
            {featured ? (
              <Link to={featured.to} className="account-featured-card">
                <div className="account-featured-card-body">
                  <span className="account-featured-kicker">{featured.label}</span>
                  <strong className="account-featured-value">{featured.value}</strong>
                  {featured.description ? (
                    <p className="account-featured-desc">{featured.description}</p>
                  ) : null}
                </div>
                <span className="account-featured-cta">Open</span>
              </Link>
            ) : null}
            {stats.length > 0 ? (
              <div className="account-profile-block" style={{ marginTop: "1.5rem" }}>
                <header className="account-block-head">
                  <h2>At a glance</h2>
                </header>
                <dl className="account-stat-row">
                  {stats.map((s) => (
                    <div
                      key={s.label}
                      className={`account-stat-item account-stat-item--${s.tone ?? "default"}`}
                    >
                      <dt>{s.label}</dt>
                      <dd>{s.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}
            {(profileUser.email || fields.length > 0) && (
              <div className="account-profile-block account-profile-block--meta">
                <p className="account-meta-note">
                  <span className="account-meta-note__label">Account details</span>
                  {[
                    ...fields,
                    ...(profileUser.email ? [{ label: "Email", value: profileUser.email }] : []),
                  ].map(
                    (f, i) => (
                      <span key={f.label} className="account-meta-note__item">
                        {i > 0 ? (
                          <span className="account-meta-note__sep" aria-hidden="true">
                            ·
                          </span>
                        ) : null}
                        <span className="account-meta-note__key">{f.label}</span> {f.value}
                      </span>
                    )
                  )}
                  <span className="account-meta-note__hint">Read-only</span>
                </p>
              </div>
            )}
          </section>
        );
      case "favourite":
        return (
          <section
            className="account-profile-favourites account-profile-panel"
            aria-labelledby="account-favourites-title"
          >
            <header className="account-block-head">
              <h2 id="account-favourites-title">Favourite</h2>
              <p className="muted">Tours you saved with Add to favourites.</p>
            </header>
            <TouristSavedPage />
          </section>
        );
      case "currency":
        return <CurrencyPreferencePanel />;
      default:
        return null;
    }
  }

  if (isTourist) {
    return (
      <AccountProfileShell
        name={user.name}
        phone={user.phone}
        role={user.role}
        email={user.email}
        walletBalance={user.walletBalance}
        tagline={tagline}
        contextLabel={contextLabel}
        contextPartners={contextPartners}
        sideNav={
          <AccountProfileStepNav
            steps={[...TOURIST_STEPS]}
            active={activeStep}
            onChange={(id) => setActiveStep(id as TouristStepId)}
          />
        }
        onWalletCta={() => setActiveStep("wallet")}
      >
        {renderTouristPanel()}
      </AccountProfileShell>
    );
  }

  return (
    <AccountProfileShell
      name={user.name}
      phone={user.phone}
      role={user.role}
      email={user.email}
      walletBalance={user.walletBalance}
      stats={stats}
      fields={fields}
      actions={actions}
      highlights={highlights}
      tagline={tagline}
      contextLabel={contextLabel}
      contextPartners={contextPartners}
      leading={<WalletHistoryPanel />}
    >
      <CurrencyPreferencePanel />
      {user.role === "AGENCY" && <AgencyLogoPanel />}
    </AccountProfileShell>
  );
}
