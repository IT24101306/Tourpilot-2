import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { DashboardLayout, PublicLayout } from "./components/Layout";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { AgenciesPage } from "./pages/AgenciesPage";
import { AgencyDetailPage } from "./pages/AgencyDetailPage";
import { TourDetailPage } from "./pages/TourDetailPage";
import { OffersPage } from "./pages/OffersPage";
import { ProfilePage } from "./pages/ProfilePage";
import { AgencyDashboard } from "./pages/AgencyDashboard";
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

const agencyLinks = [
  { to: "/dashboard/agency", label: "Overview" },
  { to: "/profile", label: "Profile" },
];

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
          <Route path="agencies/:slug" element={<AgencyDetailPage />} />
          <Route path="tours/:agencySlug/:tourSlug" element={<TourDetailPage />} />
          <Route path="itinerary/:shareToken" element={<ItinerarySharePage />} />

          <Route
            path="dashboard/agency"
            element={
              <Protected roles={["AGENCY"]}>
                <DashboardLayout links={agencyLinks} />
              </Protected>
            }
          >
            <Route index element={<AgencyDashboard />} />
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
