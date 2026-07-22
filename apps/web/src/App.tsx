import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { currentPath, loginPath } from "./utils/authRedirect";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { CurrencyProvider } from "./context/CurrencyContext";
import {
  StorefrontDomainProvider,
  useStorefrontDomain,
} from "./context/StorefrontDomainContext";
import { dashboardPathForRole } from "@tourpilot/shared";
import { AgencyDashboardLayout } from "./components/AgencyDashboardLayout";
import { DriverDashboardLayout } from "./components/DriverDashboardLayout";
import { InfluencerDashboardLayout } from "./components/InfluencerDashboardLayout";
import { PublicLayout } from "./components/Layout";
import { LandingPage } from "./pages/LandingPage";
import { DiscoverPage } from "./pages/DiscoverPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { RegisterProPage } from "./pages/RegisterProPage";
import { TermsPage } from "./pages/TermsPage";
import { AgencyDetailPage } from "./pages/AgencyDetailPage";
import { TourDetailPage } from "./pages/TourDetailPage";
import { OffersPage } from "./pages/OffersPage";
import { OfferBookPage } from "./pages/OfferBookPage";
import { ProfilePage } from "./pages/ProfilePage";
import { AgencyOverviewPage } from "./pages/agency/AgencyOverviewPage";
import { AgencyBookingsPage } from "./pages/agency/AgencyBookingsPage";
import { AgencyToursPage } from "./pages/agency/AgencyToursPage";
import { AgencyDriversPage } from "./pages/agency/AgencyDriversPage";
import { AgencyTravelersPage } from "./pages/agency/AgencyTravelersPage";
import { AgencyAllEntitiesPage } from "./pages/agency/AgencyAllEntitiesPage";
import { AgencyGroupsPage } from "./pages/agency/AgencyGroupsPage";
import { AgencyDisplayPage } from "./pages/agency/AgencyDisplayPage";
import { AgencyPartnerRequestsPage } from "./pages/agency/AgencyPartnerRequestsPage";
import { AgencyOffersPage } from "./pages/agency/AgencyOffersPage";
import { AgencyDomainPage } from "./pages/agency/AgencyDomainPage";
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
import { InfluencerCommissionRequestsPage } from "./pages/influencer/InfluencerCommissionRequestsPage";
import { InfluencerGuidePage } from "./pages/influencer/InfluencerGuidePage";
import { InfluencerDisplayPage } from "./pages/influencer/InfluencerDisplayPage";
import { InfluencerInquiriesPage } from "./pages/influencer/InfluencerInquiriesPage";
import { InfluencerTripRoomPage } from "./pages/influencer/InfluencerTripRoomPage";
import { InfluencerDomainPage } from "./pages/influencer/InfluencerDomainPage";
import { InfluencerDetailPage } from "./pages/InfluencerDetailPage";
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
import { AdminPricingPage } from "./pages/admin/AdminPricingPage";
import { AdminSettingsPage } from "./pages/admin/AdminSettingsPage";
import { AdminInfluencersPage } from "./pages/admin/AdminInfluencersPage";
import { AdminItinerariesPage } from "./pages/admin/AdminItinerariesPage";
import { AdminTripRoomPage } from "./pages/admin/AdminTripRoomPage";
import { ItinerarySharePage } from "./pages/ItinerarySharePage";
import type { ReactNode } from "react";
import type { UserRole } from "@tourpilot/shared";
import { AdminOffersPage } from "./pages/admin/AdminOffersPage";
import { AdminVouchersPage } from "./pages/admin/AdminVouchersPage";
import { AdminDashboardLayout } from "./components/AdminDashboardLayout";
import { AgencyNegotiationsPage } from "./pages/agency/AgencyNegotiationsPage";
import { AgencyTripRoomPage } from "./pages/agency/AgencyTripRoomPage";
import { TouristTravelHub } from "./components/tourist/TouristTravelHub";
import { AgencyTasksPage } from "./pages/agency/AgencyTasksPage";
import { DriverTasksPage } from "./pages/driver/DriverTasksPage";
import { SiteFooter } from "./components/SiteFooter";
import { CheckoutPage, CheckoutReturnPage } from "./pages/CheckoutPage";

function Protected({ children, roles }: { children: ReactNode; roles?: UserRole[] }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="section">Loading…</div>;
  if (!user) return <Navigate to={loginPath(currentPath(location))} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function HomeRoute() {
  const { user, loading } = useAuth();
  const storefront = useStorefrontDomain();
  // On a custom domain, serve the matching agency or influencer storefront at the root.
  if (storefront.loading) return <div className="section">Loading…</div>;
  if (storefront.isCustomDomain && storefront.influencerSlug) {
    return <InfluencerDetailPage slugOverride={storefront.influencerSlug} />;
  }
  if (storefront.isCustomDomain && storefront.agencySlug) {
    return <AgencyDetailPage slugOverride={storefront.agencySlug} />;
  }
  if (loading) return <div className="section">Loading…</div>;
  if (user?.role === "AGENCY" || user?.role === "INFLUENCER") {
    return <Navigate to={dashboardPathForRole(user.role)} replace />;
  }
  return <LandingPage />;
}

function InfluencerStorefrontRedirect() {
  const { slug } = useParams<{ slug: string }>();
  return <Navigate to={`/i/${slug ?? ""}`} replace />;
}

function InfluencerDashboardLegacyRedirect() {
  const location = useLocation();
  const suffix = location.pathname.slice("/dashboard/influencer".length);
  return <Navigate to={`/dashboard/i${suffix}${location.search}${location.hash}`} replace />;
}

function AgenciesListingRedirect() {
  return <Navigate to="/" replace />;
}

function BuildMyTripLegacyRedirect() {
  const { slug } = useParams<{ slug: string }>();
  return <Navigate to={slug ? `/agencies/${slug}` : "/"} replace />;
}

function TouristTripRoomRedirect() {
  const { inquiryId } = useParams<{ inquiryId: string }>();
  return <Navigate to={inquiryId ? `/trips?room=${inquiryId}` : "/trips"} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <CurrencyProvider>
      <StorefrontDomainProvider>
      <BrowserRouter>
        <div className="app-root">
          <div className="app-root__main">
            <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<HomeRoute />} />
            <Route path="discover" element={<DiscoverPage />} />
            <Route path="pricing" element={<LandingPage />} />
            <Route path="agencies" element={<AgenciesListingRedirect />} />
            <Route path="offers" element={<OffersPage />} />
            <Route path="offers/:offerId/book" element={<OfferBookPage />} />
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
                  <TouristTravelHub />
                </Protected>
              }
            />
            <Route
              path="checkout/:invoiceId"
              element={
                <Protected roles={["TOURIST"]}>
                  <CheckoutPage />
                </Protected>
              }
            />
            <Route
              path="checkout/:invoiceId/return"
              element={
                <Protected roles={["TOURIST"]}>
                  <CheckoutReturnPage />
                </Protected>
              }
            />
            <Route
              path="checkout/:invoiceId/cancel"
              element={
                <Protected roles={["TOURIST"]}>
                  <CheckoutReturnPage cancelled />
                </Protected>
              }
            />
            <Route path="trips/bookings" element={<Navigate to="/trips?tab=bookings" replace />} />
            <Route
              path="saved"
              element={
                <Protected roles={["TOURIST"]}>
                  <Navigate to="/trips?tab=saved" replace />
                </Protected>
              }
            />
            <Route
              path="trips/:inquiryId"
              element={<TouristTripRoomRedirect />}
            />
          </Route>

          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="register/pro" element={<RegisterProPage />} />
          <Route path="terms" element={<TermsPage />} />
          <Route path="agencies/:slug" element={<AgencyDetailPage />} />
          <Route path="agencies/:slug/build-my-trip" element={<BuildMyTripLegacyRedirect />} />
          <Route path="i/:slug" element={<InfluencerDetailPage />} />
          <Route path="influencers/:slug" element={<InfluencerStorefrontRedirect />} />
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
            <Route path="offers" element={<AgencyOffersPage />} />
            <Route path="display" element={<AgencyDisplayPage />} />
            <Route path="domain" element={<AgencyDomainPage />} />
            <Route path="partners" element={<AgencyPartnerRequestsPage />} />
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

          <Route path="dashboard/influencer/*" element={<InfluencerDashboardLegacyRedirect />} />

          <Route
            path="dashboard/i"
            element={
              <Protected roles={["INFLUENCER"]}>
                <InfluencerDashboardLayout />
              </Protected>
            }
          >
            <Route index element={<InfluencerOverviewPage />} />
            <Route path="tours" element={<InfluencerToursPage />} />
            <Route path="display" element={<InfluencerDisplayPage />} />
            <Route path="inquiries" element={<InfluencerInquiriesPage />} />
            <Route path="trip-room/:inquiryId" element={<InfluencerTripRoomPage />} />
            <Route path="codes" element={<InfluencerCodesPage />} />
            <Route path="commissions" element={<InfluencerCommissionsPage />} />
            <Route path="commission-requests" element={<InfluencerCommissionRequestsPage />} />
            <Route path="guide" element={<InfluencerGuidePage />} />
            <Route path="domain" element={<InfluencerDomainPage />} />
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
            <Route path="inquiries/:inquiryId/trip-room" element={<AdminTripRoomPage />} />
            <Route path="tours" element={<AdminToursPage />} />
            <Route path="commissions" element={<AdminCommissionsPage />} />
            <Route path="ledger" element={<AdminLedgerPage />} />
            <Route path="offers" element={<AdminOffersPage />} />
            <Route path="vouchers" element={<AdminVouchersPage />} />
            <Route path="reviews" element={<AdminReviewsPage />} />
            <Route path="drivers" element={<AdminDriversPage />} />
            <Route path="influencers" element={<AdminInfluencersPage />} />
            <Route path="itineraries" element={<AdminItinerariesPage />} />
            <Route path="cms" element={<AdminCmsPage />} />
            <Route path="pricing" element={<AdminPricingPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
          <SiteFooter />
        </div>
      </BrowserRouter>
      </StorefrontDomainProvider>
      </CurrencyProvider>
    </AuthProvider>
  );
}
