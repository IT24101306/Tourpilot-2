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
import { lkr, roleLabel } from "../components/account/accountProfileUtils";
import { useAuth } from "../context/AuthContext";
import type { InfluencerDashboardData } from "./influencer/types";

type InquirySummary = { id: string; status: string };

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
    const list = await api<{ id: string }[]>("/saved-tours/mine", { token });
    setSavedCount(list.length);
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

      highlights.push({
        id: "journey",
        label: inquiryCount > 0 ? "Your travel hub" : "Start your Sri Lanka journey",
        value:
          inquiryCount > 0
            ? `${inquiryCount} inquir${inquiryCount === 1 ? "y" : "ies"} · ${bookingCount} booking${bookingCount === 1 ? "" : "s"}`
            : "Discover trusted agencies",
        description:
          inquiryCount > 0
            ? "Track inquiries, confirmed bookings, and saved tours in one place."
            : "Curated operators, transparent itineraries, and optional add-ons.",
        to: inquiryCount > 0 ? "/trips" : "/agencies",
        span: 2,
      });

      stats.push(
        { label: "Inquiries", value: String(inquiryCount), tone: "accent" },
        { label: "Bookings", value: String(bookingCount) },
        { label: "Saved tours", value: String(savedCount) },
        { label: "Loyalty points", value: loyalty.toLocaleString() }
      );

      actions.push(
        { label: "Inquiries", to: "/trips", variant: "teal" },
        { label: "Bookings", to: "/trips/bookings" },
        { label: "Saved tours", to: "/saved" },
        { label: "Browse agencies", to: "/agencies" },
        { label: "Special offers", to: "/offers" }
      );
      break;
    }
    case "INFLUENCER": {
      if (partner) {
        tagline = partner.profile.bio;
        highlights.push({
          id: "growth",
          label: "Partner growth",
          value: lkr(partner.stats.totalEarned),
          description: `${partner.stats.activeCodes} active codes · ${partner.stats.totalClicks.toLocaleString()} link clicks · ${partner.stats.totalInquiries} inquiries`,
          to: "/dashboard/influencer",
          span: 2,
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
          to: "/dashboard/influencer",
          span: 2,
        });
      }
      actions.push(
        { label: "Referral codes", to: "/dashboard/influencer/codes", variant: "teal" },
        { label: "Commissions", to: "/dashboard/influencer/commissions" },
        { label: "Tours to promote", to: "/dashboard/influencer/tours" }
      );
      break;
    }
    case "AGENCY": {
      if (user.agency) {
        tagline = user.agency.name;
        highlights.push({
          id: "storefront",
          label: "Public storefront",
          value: user.agency.name,
          description: "Your traveler-facing page — packages, gallery, and inquiry form.",
          to: `/agencies/${user.agency.slug}`,
          span: 2,
        });
        fields.push({
          label: "Store URL",
          value: `tourpilot.app/agencies/${user.agency.slug}`,
        });
      }
      stats.push({ label: "Account", value: "Agency operator", tone: "accent" });
      actions.push(
        { label: "Manage tours", to: "/dashboard/agency/tours", variant: "teal" },
        { label: "Bookings", to: "/dashboard/agency/bookings" },
        { label: "Negotiations", to: "/dashboard/agency/negotiations" }
      );
      break;
    }
    case "DRIVER": {
      highlights.push({
        id: "schedule",
        label: "Today on the road",
        value: user.agencyDriver?.agencyName ?? "Your schedule",
        description: user.agencyDriver
          ? `Linked to ${user.agencyDriver.agencyName} · status ${user.agencyDriver.status}`
          : "View pickups, routes, and assigned tours for today.",
        to: "/dashboard/driver",
        span: 2,
      });
      stats.push({ label: "Role", value: "Field driver", tone: "accent" });
      actions.push(
        { label: "Today's schedule", to: "/dashboard/driver", variant: "teal" },
        { label: "Assigned tours", to: "/dashboard/driver/assigned" },
        { label: "Edit driver profile", to: "/dashboard/driver/profile" }
      );
      break;
    }
    case "ADMIN": {
      highlights.push({
        id: "governance",
        label: "Platform oversight",
        value: "Approvals & offers",
        description: "Review agencies, manage platform offers, and keep TourPilot running smoothly.",
        to: "/dashboard/admin",
        span: 2,
      });
      stats.push({ label: "Access level", value: "Administrator", tone: "accent" });
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
    >
      {loadError && <p className="form-error">{loadError}</p>}
      {loadingExtra && user.role === "TOURIST" && (
        <p className="muted">Refreshing your travel activity…</p>
      )}
    </AccountProfileShell>
  );
}
