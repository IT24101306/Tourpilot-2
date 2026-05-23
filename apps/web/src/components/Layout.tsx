import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function PublicLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="brand">
          Tour<span>Pilot</span>
        </Link>
        <nav className="nav">
          <Link to="/agencies">Agencies</Link>
          <Link to="/offers">Offers</Link>
          {user ? (
            <>
              <Link to="/profile">Profile</Link>
              {user.role === "AGENCY" && <Link to="/dashboard/agency">Dashboard</Link>}
              {user.role === "INFLUENCER" && <Link to="/dashboard/influencer">Dashboard</Link>}
              {user.role === "ADMIN" && <Link to="/dashboard/admin">Admin</Link>}
              <button type="button" className="btn btn-ghost" onClick={logout}>
                Log out
              </button>
            </>
          ) : (
            <Link to="/login" className="btn btn-teal">
              Login
            </Link>
          )}
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
      <header className="topbar">
        <Link to="/" className="brand">
          Tour<span>Pilot</span>
        </Link>
        <div className="nav">
          <span className="muted">{user?.name}</span>
          <span className="muted">LKR {user?.walletBalance?.toFixed(0)}</span>
          <button type="button" className="btn btn-ghost" onClick={logout}>
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
