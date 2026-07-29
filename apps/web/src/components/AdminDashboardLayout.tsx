import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ConfirmActionProvider } from "./confirm/ConfirmActionContext";
import { TourPilotBrand } from "./TourPilotBrand";
import { HUB_SECTIONS, hubContainingPath } from "./admin/adminHubConfig";

export function AdminDashboardLayout() {
  const location = useLocation();
  const [openHubId, setOpenHubId] = useState<string | null>(null);
  const menusRef = useRef<HTMLDivElement>(null);
  const activeHub = hubContainingPath(location.pathname);

  useEffect(() => {
    setOpenHubId(null);
  }, [location.pathname]);

  useEffect(() => {
    if (!openHubId) return;
    function onDoc(e: MouseEvent) {
      if (!menusRef.current?.contains(e.target as Node)) setOpenHubId(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenHubId(null);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [openHubId]);

  return (
    <ConfirmActionProvider>
      <div className="agency-dashboard admin-dashboard">
        <div className="agency-dash-chrome">
          <header className="topbar topbar--agency-dash">
            <div className="topbar-brand">
              <TourPilotBrand onDark />
              <span className="topbar-context">Platform admin</span>
            </div>
            <nav className="nav nav--light" aria-label="Admin utilities">
              <div className="nav-actions nav-actions--light">
                <Link to="/profile" className="nav-link-light">
                  Account
                </Link>
                <Link to="/" className="nav-link-light">
                  Public site
                </Link>
              </div>
            </nav>
          </header>

          <nav className="agency-tabs admin-tabs" aria-label="Admin hubs">
            <div className="admin-tabs__list" ref={menusRef}>
              <NavLink
                to="/dashboard/admin"
                end
                className={({ isActive }) => `agency-tab${isActive ? " active" : ""}`}
              >
                Overview
              </NavLink>

              {HUB_SECTIONS.map((hub) => {
                const isOpen = openHubId === hub.id;
                const isActive = activeHub?.id === hub.id;
                return (
                  <div key={hub.id} className="admin-tabs__hub">
                    <button
                      type="button"
                      className={`agency-tab admin-tabs__hub-btn${isActive ? " active" : ""}${
                        isOpen ? " is-open" : ""
                      }`}
                      aria-expanded={isOpen}
                      aria-haspopup="menu"
                      aria-controls={`admin-hub-menu-${hub.id}`}
                      onClick={() => setOpenHubId((id) => (id === hub.id ? null : hub.id))}
                    >
                      {hub.title}
                      <span className="admin-tabs__chevron" aria-hidden="true">
                        ▾
                      </span>
                    </button>
                    {isOpen && (
                      <div
                        id={`admin-hub-menu-${hub.id}`}
                        className="admin-tabs__menu"
                        role="menu"
                        aria-label={hub.title}
                      >
                        <p className="admin-tabs__menu-blurb">{hub.blurb}</p>
                        {hub.modules.map((mod) => (
                          <NavLink
                            key={mod.id}
                            to={mod.to}
                            role="menuitem"
                            className={({ isActive }) =>
                              `admin-tabs__menu-link${isActive ? " is-active" : ""}`
                            }
                            onClick={() => setOpenHubId(null)}
                          >
                            <span className="admin-tabs__menu-title">
                              {mod.navLabel ?? mod.title}
                            </span>
                            <span className="admin-tabs__menu-desc">{mod.description}</span>
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </nav>
        </div>

        <section className="agency-content admin-content">
          <Outlet />
        </section>
      </div>
    </ConfirmActionProvider>
  );
}
