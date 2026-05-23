import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { DashboardLayout, PublicLayout } from "./components/Layout";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { RegisterProPage } from "./pages/RegisterProPage";
import { AgenciesPage } from "./pages/AgenciesPage";
import { AgencyDetailPage } from "./pages/AgencyDetailPage";
import { TourDetailPage } from "./pages/TourDetailPage";
import { OffersPage } from "./pages/OffersPage";
import { ProfilePage } from "./pages/ProfilePage";
import { AgencyDashboardLayout } from "./components/AgencyDashboardLayout";
import { AgencyOverviewPage } from "./pages/agency/AgencyOverviewPage";
import { AgencyBookingsPage } from "./pages/agency/AgencyBookingsPage";
import { AgencyToursPage } from "./pages/agency/AgencyToursPage";
import { AgencyDriversPage } from "./pages/agency/AgencyDriversPage";
import { AgencyTravelersPage } from "./pages/agency/AgencyTravelersPage";
import { AgencyAllEntitiesPage } from "./pages/agency/AgencyAllEntitiesPage";
import { AgencyGroupsPage } from "./pages/agency/AgencyGroupsPage";
import { DriverDashboardLayout } from "./components/DriverDashboardLayout";
import { DriverOverviewPage } from "./pages/driver/DriverOverviewPage";
import { DriverAssignedToursPage } from "./pages/driver/DriverAssignedToursPage";
import { DriverSchedulePage } from "./pages/driver/DriverSchedulePage";
import { DriverVehiclePage } from "./pages/driver/DriverVehiclePage";
import { DriverEarningsPage } from "./pages/driver/DriverEarningsPage";
import { DriverProfilePage } from "./pages/driver/DriverProfilePage";
import { InfluencerDashboard } from "./pages/InfluencerDashboard";
import { AdminDashboard } from "./pages/AdminDashboard";
import { ItinerarySharePage } from "./pages/ItinerarySharePage";
import type { ReactNode } from "react";
import type { UserRole } from "@tourpilot/shared";

function Protected({ children, roles }: { children: ReactNode; roles?: UserRole[] }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="section">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const influencerLinks = [
  { to: "/dashboard/influencer", label: "Referrals" },
  { to: "/profile", label: "Profile" },
];

const adminLinks = [
  { to: "/dashboard/admin", label: "Admin" },
  { to: "/profile", label: "Profile" },
];

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<LandingPage />} />
            <Route path="agencies" element={<AgenciesPage />} />
            <Route path="offers" element={<OffersPage />} />
            <Route
              path="profile"
              element={
                <Protected>
                  <ProfilePage />
                </Protected>
              }
            />
          </Route>

          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="register/pro" element={<RegisterProPage />} />
          <Route path="agencies/:slug" element={<AgencyDetailPage />} />
          <Route path="tours/:agencySlug/:tourSlug" element={<TourDetailPage />} />
          <Route path="itinerary/:shareToken" element={<ItinerarySharePage />} />

          <Route
            path="dashboard/agency"
            element={
              <Protected roles={["AGENCY"]}>
                <AgencyDashboardLayout />
              </Protected>
            }
          >
            <Route index element={<AgencyOverviewPage />} />
            <Route path="bookings" element={<AgencyBookingsPage />} />
            <Route path="tours" element={<AgencyToursPage />} />
            <Route path="drivers" element={<AgencyDriversPage />} />
            <Route path="travelers" element={<AgencyTravelersPage />} />
            <Route path="all" element={<AgencyAllEntitiesPage />} />
            <Route path="groups" element={<AgencyGroupsPage />} />
          </Route>

          <Route
            path="dashboard/driver"
            element={
              <Protected roles={["DRIVER"]}>
                <DriverDashboardLayout />
              </Protected>
            }
          >
            <Route index element={<DriverOverviewPage />} />
            <Route path="assigned" element={<DriverAssignedToursPage />} />
            <Route path="schedule" element={<DriverSchedulePage />} />
            <Route path="vehicle" element={<DriverVehiclePage />} />
            <Route path="earnings" element={<DriverEarningsPage />} />
            <Route path="profile" element={<DriverProfilePage />} />
          </Route>

          <Route
            path="dashboard/influencer"
            element={
              <Protected roles={["INFLUENCER"]}>
                <DashboardLayout links={influencerLinks} />
              </Protected>
            }
          >
            <Route index element={<InfluencerDashboard />} />
          </Route>

          <Route
            path="dashboard/admin"
            element={
              <Protected roles={["ADMIN"]}>
                <DashboardLayout links={adminLinks} />
              </Protected>
            }
          >
            <Route index element={<AdminDashboard />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
