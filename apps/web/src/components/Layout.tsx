import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { NotificationBell } from "./NotificationBell";
import { navLinkClass } from "../utils/navLinkClass";

export function PublicLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="shell">
      <header className="topbar topbar--site">
        <Link to="/" className="brand">
          Tour<span>Pilot</span>
        </Link>
        <nav className="nav" aria-label="Primary">
          <div className="nav-links">
            <NavLink to="/agencies" className={navLinkClass}>
              Agencies
            </NavLink>
            <NavLink to="/offers" className={navLinkClass}>
              Offers
            </NavLink>
            {user?.role === "TOURIST" && (
              <>
                <NavLink to="/trips" className={navLinkClass}>
                  My travel
                </NavLink>
                <NavLink to="/saved" className={navLinkClass}>
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
                  <NavLink to="/dashboard/influencer" className={navLinkClass}>
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
        <Link to="/" className="brand">
          Tour<span>Pilot</span>
        </Link>
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
