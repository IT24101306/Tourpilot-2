import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AgencyDashboardLayout } from "./components/AgencyDashboardLayout";
import { DriverDashboardLayout } from "./components/DriverDashboardLayout";
import { InfluencerDashboardLayout } from "./components/InfluencerDashboardLayout";
import { PublicLayout } from "./components/Layout";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { RegisterProPage } from "./pages/RegisterProPage";
import { AgenciesPage } from "./pages/AgenciesPage";
import { AgencyDetailPage } from "./pages/AgencyDetailPage";
import { TourDetailPage } from "./pages/TourDetailPage";
import { OffersPage } from "./pages/OffersPage";
import { ProfilePage } from "./pages/ProfilePage";
import { AgencyOverviewPage } from "./pages/agency/AgencyOverviewPage";
import { AgencyBookingsPage } from "./pages/agency/AgencyBookingsPage";
import { AgencyToursPage } from "./pages/agency/AgencyToursPage";
import { AgencyDriversPage } from "./pages/agency/AgencyDriversPage";
import { AgencyTravelersPage } from "./pages/agency/AgencyTravelersPage";
import { AgencyAllEntitiesPage } from "./pages/agency/AgencyAllEntitiesPage";
import { AgencyGroupsPage } from "./pages/agency/AgencyGroupsPage";
import { DriverOverviewPage } from "./pages/driver/DriverOverviewPage";
import { DriverAssignedToursPage } from "./pages/driver/DriverAssignedToursPage";
import { DriverSchedulePage } from "./pages/driver/DriverSchedulePage";
import { DriverVehiclePage } from "./pages/driver/DriverVehiclePage";
import { DriverEarningsPage } from "./pages/driver/DriverEarningsPage";
import { DriverProfilePage } from "./pages/driver/DriverProfilePage";
import { InfluencerOverviewPage } from "./pages/influencer/InfluencerOverviewPage";
import { InfluencerToursPage } from "./pages/influencer/InfluencerToursPage";
import { InfluencerCodesPage } from "./pages/influencer/InfluencerCodesPage";
import { InfluencerCommissionsPage } from "./pages/influencer/InfluencerCommissionsPage";
import { InfluencerGuidePage } from "./pages/influencer/InfluencerGuidePage";
import { AdminOverviewPage } from "./pages/admin/AdminOverviewPage";
import { AdminAgenciesPage } from "./pages/admin/AdminAgenciesPage";
import { AdminUsersPage } from "./pages/admin/AdminUsersPage";
import { AdminToursPage } from "./pages/admin/AdminToursPage";
import { AdminInquiriesPage } from "./pages/admin/AdminInquiriesPage";
import { AdminCommissionsPage } from "./pages/admin/AdminCommissionsPage";
import { AdminLedgerPage } from "./pages/admin/AdminLedgerPage";
import { AdminReviewsPage } from "./pages/admin/AdminReviewsPage";
import { AdminDriversPage } from "./pages/admin/AdminDriversPage";
import { AdminCmsPage } from "./pages/admin/AdminCmsPage";
import { ItinerarySharePage } from "./pages/ItinerarySharePage";
import type { ReactNode } from "react";
import type { UserRole } from "@tourpilot/shared";
import { AdminOffersPage } from "./pages/admin/AdminOffersPage";
import { AdminDashboardLayout } from "./components/AdminDashboardLayout";
import { AgencyNegotiationsPage } from "./pages/agency/AgencyNegotiationsPage";
import { AgencyTripRoomPage } from "./pages/agency/AgencyTripRoomPage";
import { TouristTripsPage } from "./pages/TouristTripsPage";
import { TouristTripRoomPage } from "./pages/TouristTripRoomPage";
import { AgencyTasksPage } from "./pages/agency/AgencyTasksPage";
import { DriverTasksPage } from "./pages/driver/DriverTasksPage";

function Protected({ children, roles }: { children: ReactNode; roles?: UserRole[] }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="section">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

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
            <Route
              path="trips"
              element={
                <Protected roles={["TOURIST"]}>
                  <TouristTripsPage />
                </Protected>
              }
            />
            <Route
              path="trips/:inquiryId"
              element={
                <Protected roles={["TOURIST"]}>
                  <TouristTripRoomPage />
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
            <Route path="negotiations" element={<AgencyNegotiationsPage />} />
            <Route path="trip-room/:inquiryId" element={<AgencyTripRoomPage />} />
            <Route path="tasks" element={<AgencyTasksPage />} />
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
            <Route index element={<DriverSchedulePage />} />
            <Route path="overview" element={<DriverOverviewPage />} />
            <Route path="assigned" element={<DriverAssignedToursPage />} />
            <Route path="vehicle" element={<DriverVehiclePage />} />
            <Route path="earnings" element={<DriverEarningsPage />} />
            <Route path="profile" element={<DriverProfilePage />} />
            <Route path="tasks" element={<DriverTasksPage />} />
          </Route>

          <Route
            path="dashboard/influencer"
            element={
              <Protected roles={["INFLUENCER"]}>
                <InfluencerDashboardLayout />
              </Protected>
            }
          >
            <Route index element={<InfluencerOverviewPage />} />
            <Route path="tours" element={<InfluencerToursPage />} />
            <Route path="codes" element={<InfluencerCodesPage />} />
            <Route path="commissions" element={<InfluencerCommissionsPage />} />
            <Route path="guide" element={<InfluencerGuidePage />} />
          </Route>

          <Route
            path="dashboard/admin"
            element={
              <Protected roles={["ADMIN"]}>
                <AdminDashboardLayout />
              </Protected>
            }
          >
            <Route index element={<AdminOverviewPage />} />
            <Route path="agencies" element={<AdminAgenciesPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="inquiries" element={<AdminInquiriesPage />} />
            <Route path="tours" element={<AdminToursPage />} />
            <Route path="commissions" element={<AdminCommissionsPage />} />
            <Route path="ledger" element={<AdminLedgerPage />} />
            <Route path="offers" element={<AdminOffersPage />} />
            <Route path="reviews" element={<AdminReviewsPage />} />
            <Route path="drivers" element={<AdminDriversPage />} />
            <Route path="cms" element={<AdminCmsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
