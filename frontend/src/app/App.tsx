import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AdminLayout } from "@/app/layouts/AdminLayout";
import { DriverLayout } from "@/app/layouts/DriverLayout";
import { PassengerLayout } from "@/app/layouts/PassengerLayout";
import { RequireAuth } from "@/app/layouts/RequireAuth";

const LandingPage = lazy(() => import("@/features/landing/LandingPage"));
const LoginPage = lazy(() => import("@/features/auth/LoginPage"));
const RegisterPage = lazy(() => import("@/features/auth/RegisterPage"));

const HomePage = lazy(() => import("@/features/passenger/HomePage"));
const BookPage = lazy(() => import("@/features/passenger/BookPage"));
const RidesPage = lazy(() => import("@/features/passenger/RidesPage"));
const RideDetailPage = lazy(() => import("@/features/passenger/RideDetailPage"));
const WalletPage = lazy(() => import("@/features/passenger/WalletPage"));
const ProfilePage = lazy(() => import("@/features/passenger/ProfilePage"));
const NotificationsPage = lazy(() => import("@/features/passenger/NotificationsPage"));

const DriverOnboardingPage = lazy(() => import("@/features/driver/OnboardingPage"));
const DriverTodayPage = lazy(() => import("@/features/driver/TodayPage"));
const DriverTripsPage = lazy(() => import("@/features/driver/TripsPage"));
const DriverAvailabilityPage = lazy(() => import("@/features/driver/AvailabilityPage"));
const DriverEarningsPage = lazy(() => import("@/features/driver/EarningsPage"));
const DriverProfilePage = lazy(() => import("@/features/driver/ProfilePage"));
const DriverNotificationsPage = lazy(() => import("@/features/driver/NotificationsPage"));

const AdminDashboardPage = lazy(() => import("@/features/admin/DashboardPage"));
const AdminRoutesPage = lazy(() => import("@/features/admin/RoutesPage"));
const AdminDriversPage = lazy(() => import("@/features/admin/DriversPage"));
const AdminTripsPage = lazy(() => import("@/features/admin/TripsBookingsPage"));
const AdminSettingsPage = lazy(() => import("@/features/admin/SettingsPage"));

function PageLoader() {
  return <div className="flex h-screen items-center justify-center text-text-secondary">Loading…</div>;
}

export function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route
            path="/app"
            element={
              <RequireAuth roles={["passenger"]}>
                <PassengerLayout />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="home" replace />} />
            <Route path="home" element={<HomePage />} />
            <Route path="book" element={<BookPage />} />
            <Route path="rides" element={<RidesPage />} />
            <Route path="rides/:id" element={<RideDetailPage />} />
            <Route path="wallet" element={<WalletPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="notifications" element={<NotificationsPage />} />
          </Route>

          <Route
            path="/driver"
            element={
              <RequireAuth roles={["driver"]}>
                <DriverLayout />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="today" replace />} />
            <Route path="onboarding" element={<DriverOnboardingPage />} />
            <Route path="today" element={<DriverTodayPage />} />
            <Route path="trips" element={<DriverTripsPage />} />
            <Route path="availability" element={<DriverAvailabilityPage />} />
            <Route path="earnings" element={<DriverEarningsPage />} />
            <Route path="profile" element={<DriverProfilePage />} />
            <Route path="notifications" element={<DriverNotificationsPage />} />
          </Route>

          <Route
            path="/admin"
            element={
              <RequireAuth roles={["admin"]}>
                <AdminLayout />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboardPage />} />
            <Route path="routes" element={<AdminRoutesPage />} />
            <Route path="drivers" element={<AdminDriversPage />} />
            <Route path="trips" element={<AdminTripsPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
