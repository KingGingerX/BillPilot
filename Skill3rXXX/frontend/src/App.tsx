/**
 * App — root routing component.
 * Public routes (login/register/store) are accessible without auth.
 * Protected routes redirect to /login if no token is present.
 */
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store";

// Layouts
import MainLayout from "./components/Layout/MainLayout";
import AuthLayout from "./components/Layout/AuthLayout";

// Pages
import LoginPage from "./pages/Login";
import RegisterPage from "./pages/Register";
import DashboardPage from "./pages/Dashboard";
import ProductsPage from "./pages/Products";
import AffiliatesPage from "./pages/Affiliates";
import SubscriptionsPage from "./pages/Subscriptions";
import AnalyticsPage from "./pages/Analytics";
import ContentPage from "./pages/Content";
import StorePage from "./pages/Store";
import NotFoundPage from "./pages/NotFound";

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuth = useAuthStore((s) => s.isAuthenticated);
  return isAuth ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      {/* Public auth pages */}
      <Route element={<AuthLayout />}>
        <Route path="/login"    element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      {/* Public storefront */}
      <Route path="/store" element={<StorePage />} />

      {/* Protected dashboard */}
      <Route
        element={
          <PrivateRoute>
            <MainLayout />
          </PrivateRoute>
        }
      >
        <Route index                element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard"    element={<DashboardPage />} />
        <Route path="/products"     element={<ProductsPage />} />
        <Route path="/affiliates"   element={<AffiliatesPage />} />
        <Route path="/subscriptions" element={<SubscriptionsPage />} />
        <Route path="/analytics"    element={<AnalyticsPage />} />
        <Route path="/content"      element={<ContentPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
