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
        onDark
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
        onDark
      />
    );
  }
  if (user.role === "DRIVER" && user.agencyDriver) {
    return (
      <ClientBrand
        name={user.agencyDriver.agencyName}
        to="/dashboard/driver"
        subtitle="My account"
        onDark
      />
    );
  }
  if (user.role === "ADMIN") {
    return <TourPilotBrand onDark />;
  }
  return <TourPilotBrand onDark />;
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
    <div
      className={`shell${onMarketingHome ? " shell--marketing-home" : ""}${
        onProfile ? " shell--dash-profile" : ""
      }`}
    >
      <header className={`topbar ${onProfile ? "topbar--agency-dash" : "topbar--site"}`}>
        {onProfile ? <ProfileTopBrand /> : <TourPilotBrand />}
        <nav className={`nav${onProfile ? " nav--light" : ""}`} aria-label="Primary">
          <div className="nav-links">
            {user?.role === "TOURIST" && (
              <NavLink
                to="/trips"
                className={() =>
                  onProfile
                    ? `nav-link-light${onInquiries ? " nav-link-light--active" : ""}`
                    : navLinkClass({ isActive: onInquiries })
                }
              >
                Inquiries
              </NavLink>
            )}
            {!onProfile && (
              <>
                <NavLink to={{ pathname: "/", hash: "pricing" }} className={navLinkClass}>
                  Pricing
                </NavLink>
                <NavLink to="/offers" className={navLinkClass}>
                  Offers
                </NavLink>
              </>
            )}
            {user?.role === "TOURIST" && (
              <>
                <NavLink
                  to="/trips?tab=bookings"
                  className={() =>
                    onProfile
                      ? `nav-link-light${onBookings ? " nav-link-light--active" : ""}`
                      : navLinkClass({ isActive: onBookings })
                  }
                >
                  Bookings
                </NavLink>
                <NavLink
                  to="/trips?tab=saved"
                  className={() =>
                    onProfile
                      ? `nav-link-light${onSaved ? " nav-link-light--active" : ""}`
                      : navLinkClass({ isActive: onSaved })
                  }
                >
                  Saved
                </NavLink>
              </>
            )}
          </div>
          <div className={`nav-actions${onProfile ? " nav-actions--light" : ""}`}>
            {user ? (
              <>
                <NotificationBell />
                <NavLink
                  to="/profile"
                  className={({ isActive }) =>
                    onProfile
                      ? `nav-link-light${isActive ? " nav-link-light--active" : ""}`
                      : navLinkClass({ isActive })
                  }
                >
                  Profile
                </NavLink>
                {user.role === "AGENCY" && (
                  <NavLink
                    to="/dashboard/agency"
                    className={({ isActive }) =>
                      onProfile
                        ? `nav-link-light${isActive ? " nav-link-light--active" : ""}`
                        : navLinkClass({ isActive })
                    }
                  >
                    Dashboard
                  </NavLink>
                )}
                {user.role === "DRIVER" && (
                  <NavLink
                    to="/dashboard/driver"
                    className={({ isActive }) =>
                      onProfile
                        ? `nav-link-light${isActive ? " nav-link-light--active" : ""}`
                        : navLinkClass({ isActive })
                    }
                  >
                    Dashboard
                  </NavLink>
                )}
                {user.role === "INFLUENCER" && (
                  <NavLink
                    to="/dashboard/i"
                    className={({ isActive }) =>
                      onProfile
                        ? `nav-link-light${isActive ? " nav-link-light--active" : ""}`
                        : navLinkClass({ isActive })
                    }
                  >
                    Dashboard
                  </NavLink>
                )}
                {user.role === "ADMIN" && (
                  <NavLink
                    to="/dashboard/admin"
                    className={({ isActive }) =>
                      onProfile
                        ? `nav-link-light${isActive ? " nav-link-light--active" : ""}`
                        : navLinkClass({ isActive })
                    }
                  >
                    Admin
                  </NavLink>
                )}
                <button
                  type="button"
                  className={onProfile ? "nav-link-light" : "btn btn-ghost btn-nav"}
                  onClick={logout}
                >
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
            <span className="nav-meta-wallet">
              {Math.round(user?.walletBalance ?? 0).toLocaleString()} Credits
            </span>
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
