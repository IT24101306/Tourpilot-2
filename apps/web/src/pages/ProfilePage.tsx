import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { dashboardPathForRole } from "@tourpilot/shared";
import { api } from "../api/client";
import { AccountProfileShell } from "../components/account/AccountProfileShell";
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
import { useAuth } from "../context/AuthContext";
import type { InfluencerDashboardData } from "./influencer/types";

type InquirySummary = {
  id: string;
  status: string;
  agency?: { id: string; name: string; slug: string; logoUrl?: string | null } | null;
  handlerInfluencer?: { id: string; name: string; slug: string | null } | null;
  whiteLabel?: boolean;
};

export function ProfilePage() {
  const { user, token } = useAuth();
  const [inquiries, setInquiries] = useState<InquirySummary[]>([]);
  const [savedCount, setSavedCount] = useState(0);
  const [partner, setPartner] = useState<InfluencerDashboardData | null>(null);
  const [loadingExtra, setLoadingExtra] = useState(false);
  const [loadError, setLoadError] = useState("");

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
    const [tours, plans] = await Promise.all([
      api<{ id: string }[]>("/saved-tours/mine", { token }),
      api<{ id: string }[]>("/saved-trip-plans/mine", { token }),
    ]);
    setSavedCount(tours.length + plans.length);
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

  if (!user) {
    return (
      <section className="section account-profile">
        <p>
          Please <Link to="/login">log in</Link>.
        </p>
      </section>
    );
  }

  const stats: AccountStat[] = [];
  const fields: AccountField[] = [];
  const actions: AccountAction[] = [];
  const highlights: AccountHighlight[] = [];
  let tagline: string | null = null;
  let contextLabel: string | null = null;
  let contextPartners: { name: string; slug?: string | null; logoUrl?: string | null; href?: string }[] =
    [];

  const dashPath = dashboardPathForRole(user.role);
  if (dashPath !== "/profile") {
    actions.push({
      label: `${roleLabel(user.role)} dashboard`,
      to: dashPath,
      variant: "primary",
    });
  }

  switch (user.role) {
    case "TOURIST": {
      const loyalty = user.touristProfile?.loyaltyPoints ?? 0;
      const inquiryCount = inquiries.length;
      const bookingCount = inquiries.filter((i) => i.status === "ACCEPTED").length;

      const partnerMap = new Map<string, { name: string; slug?: string | null; logoUrl?: string | null; href?: string }>();
      for (const inquiry of inquiries) {
        if (inquiry.whiteLabel && inquiry.handlerInfluencer?.name) {
          const key = `i:${inquiry.handlerInfluencer.id}`;
          if (!partnerMap.has(key)) {
            partnerMap.set(key, {
              name: inquiry.handlerInfluencer.name,
              slug: inquiry.handlerInfluencer.slug,
              href: inquiry.handlerInfluencer.slug
                ? `/i/${inquiry.handlerInfluencer.slug}`
                : `/trips?room=${inquiry.id}`,
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

      actions.push(
        { label: "Inquiries", to: "/trips", variant: "teal" },
        { label: "Bookings", to: "/trips?tab=bookings" },
        { label: "Saved", to: "/trips?tab=saved" }
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
        contextLabel = `${user.agency.name} · Agency dashboard`;
        tagline = "You are managing this agency workspace.";
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
        fields.push({
          label: "Store URL",
          value: `tourpilot.app/agencies/${user.agency.slug}`,
        });
      } else {
        contextLabel = "Agency account";
      }
      actions.push(
        { label: "Manage tours", to: "/dashboard/agency/tours", variant: "teal" },
        { label: "Bookings", to: "/dashboard/agency/bookings" },
        { label: "Negotiations", to: "/dashboard/agency/negotiations" }
      );
      if (user.agency?.features?.offers !== false) {
        actions.push({ label: "Offers", to: "/dashboard/agency/offers" });
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
      {loadError && <p className="form-error">{loadError}</p>}
      {loadingExtra && user.role === "TOURIST" && (
        <p className="muted">Refreshing your travel activity…</p>
      )}
      {user.role === "TOURIST" && <CurrencyPreferencePanel />}
      {user.role === "AGENCY" && <AgencyLogoPanel />}
    </AccountProfileShell>
  );
}
