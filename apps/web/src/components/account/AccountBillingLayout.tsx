import { Link, NavLink, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "../../styles/account-billing.css";

const NAV = [
  { to: "/profile/billing/subscriptions", label: "Subscriptions", end: true },
  { to: "/profile/billing/history", label: "Payment history", end: true },
  { to: "/profile/billing/methods", label: "Payment methods", end: true },
] as const;

export function AccountBillingLayout() {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.role !== "AGENCY") {
    return <Navigate to="/profile" replace />;
  }
  if (user.agencyMembership === "staff") {
    return <Navigate to="/profile" replace />;
  }

  return (
    <div className="account-billing section">
      <div className="account-billing__shell">
        <aside className="account-billing__nav" aria-label="Billing">
          <p className="account-billing__nav-title">Billing</p>
          <ul className="account-billing__nav-list">
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `account-billing__nav-link${isActive ? " is-active" : ""}`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
          <Link to="/profile" className="account-billing__back">
            ← Account overview
          </Link>
        </aside>
        <main className="account-billing__main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
