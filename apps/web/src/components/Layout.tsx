import { Link, NavLink, Outlet, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useStorefrontDomain } from "../context/StorefrontDomainContext";
import { NotificationBell } from "./NotificationBell";
import { ClientBrand } from "./ClientBrand";
import { TourPilotBrand } from "./TourPilotBrand";
import { navLinkClass } from "../utils/navLinkClass";

function ProfileTopBrand() {
  const { user } = useAuth();
  if (!user) return <span className="topbar-context">My account</span>;

  if (user.role === "AGENCY" && user.agency) {
    return (
      <ClientBrand
        name={user.agency.name}
        logoUrl={user.agency.logoUrl}
        to={`/agencies/${user.agency.slug}`}
        subtitle="My account"
      />
    );
  }
  if (user.role === "INFLUENCER") {
    return (
      <ClientBrand
        name={user.name}
        logoUrl={user.avatarUrl}
        to="/profile"
        subtitle="My account"
      />
    );
  }
  if (user.role === "DRIVER" && user.agencyDriver) {
    return (
      <ClientBrand
        name={user.agencyDriver.agencyName}
        to="/dashboard/driver"
        subtitle="My account"
      />
    );
  }
  if (user.role === "ADMIN") {
    return <TourPilotBrand />;
  }
  return <span className="topbar-context">My account</span>;
}

export function PublicLayout() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const storefront = useStorefrontDomain();
  const onProfile = pathname === "/profile";
  const onTravel = pathname === "/trips";
  const travelTab = searchParams.get("tab");
  const onInquiries = onTravel && (!travelTab || travelTab === "inquiries");
  const onBookings = onTravel && travelTab === "bookings";
  const onSaved = onTravel && travelTab === "saved";
  const onMarketingHome =
    pathname === "/" && !storefront.loading && !storefront.isCustomDomain;

  return (
    <div className={`shell${onMarketingHome ? " shell--marketing-home" : ""}`}>
      <header className="topbar topbar--site">
        {onProfile ? <ProfileTopBrand /> : <TourPilotBrand />}
        <nav className="nav" aria-label="Primary">
          <div className="nav-links">
            {user?.role === "TOURIST" && (
              <NavLink to="/trips" className={() => navLinkClass({ isActive: onInquiries })}>
                Inquiries
              </NavLink>
            )}
            {!onProfile && (
              <>
                <NavLink to="/#pricing" className={navLinkClass}>
                  Pricing
                </NavLink>
                <NavLink to="/offers" className={navLinkClass}>
                  Offers
                </NavLink>
                <NavLink to="/discover" className={navLinkClass}>
                  Discover
                </NavLink>
              </>
            )}
            {user?.role === "TOURIST" && (
              <>
                <NavLink
                  to="/trips?tab=bookings"
                  className={() => navLinkClass({ isActive: onBookings })}
                >
                  Bookings
                </NavLink>
                <NavLink
                  to="/trips?tab=saved"
                  className={() => navLinkClass({ isActive: onSaved })}
                >
                  Saved
                </NavLink>
              </>
            )}
          </div>
          <div className="nav-actions">
            {user ? (
              <>
                <NotificationBell />
                <NavLink to="/profile" className={navLinkClass}>
                  Profile
                </NavLink>
                {user.role === "AGENCY" && (
                  <NavLink to="/dashboard/agency" className={navLinkClass}>
                    Dashboard
                  </NavLink>
                )}
                {user.role === "DRIVER" && (
                  <NavLink to="/dashboard/driver" className={navLinkClass}>
                    Dashboard
                  </NavLink>
                )}
                {user.role === "INFLUENCER" && (
                  <NavLink to="/dashboard/i" className={navLinkClass}>
                    Dashboard
                  </NavLink>
                )}
                {user.role === "ADMIN" && (
                  <NavLink to="/dashboard/admin" className={navLinkClass}>
                    Admin
                  </NavLink>
                )}
                <button type="button" className="btn btn-ghost btn-nav" onClick={logout}>
                  Log out
                </button>
              </>
            ) : (
              <>
                <NavLink to="/register" className={navLinkClass}>
                  Sign up
                </NavLink>
                <NavLink to="/login" className="btn btn-teal btn-nav">
                  Login
                </NavLink>
              </>
            )}
          </div>
        </nav>
      </header>
      <Outlet />
    </div>
  );
}

export function DashboardLayout({ links }: { links: { to: string; label: string }[] }) {
  const { user, logout } = useAuth();

  return (
    <div className="shell">
      <header className="topbar topbar--site">
        <TourPilotBrand />
        <div className="nav nav--dashboard">
          <div className="nav-meta">
            <span className="nav-meta-name">{user?.name}</span>
            <span className="nav-meta-wallet">LKR {user?.walletBalance?.toFixed(0)}</span>
          </div>
          <button type="button" className="btn btn-ghost btn-nav" onClick={logout}>
            Log out
          </button>
        </div>
      </header>
      <div className="dashboard">
        <aside className="sidebar">
          {links.map((l) => (
            <Link key={l.to} to={l.to}>
              {l.label}
            </Link>
          ))}
        </aside>
        <main className="dashboard-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
