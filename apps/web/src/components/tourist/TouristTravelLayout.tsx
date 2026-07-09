import { NavLink, Outlet } from "react-router-dom";
import { ModuleHeader } from "../module/ModuleHeader";
import { navLinkClass } from "../../utils/navLinkClass";

export function TouristTravelLayout() {
  return (
    <section className="section module-shell module-guided tourist-travel-shell">
      <ModuleHeader
        module="guided"
        title="My travel"
        subtitle="Inquiries, confirmed bookings, and saved tours."
      >
      </ModuleHeader>

      <nav className="tourist-travel-tabs" aria-label="Travel sections">
        <NavLink to="/trips" end className={navLinkClass}>
          Inquiries
        </NavLink>
        <NavLink to="/trips/bookings" className={navLinkClass}>
          Bookings
        </NavLink>
        <NavLink to="/saved" className={navLinkClass}>
          Saved
        </NavLink>
      </nav>

      <Outlet />
    </section>
  );
}
