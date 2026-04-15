import { Outlet, Navigate } from "react-router-dom";
import { useAuthStore } from "../../store";

export default function AuthLayout() {
  const isAuth = useAuthStore((s) => s.isAuthenticated);
  if (isAuth) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">💰</div>
          <h1 className="text-2xl font-bold text-white">PIMS</h1>
          <p className="text-gray-400 mt-1">Passive Income Master System</p>
        </div>

        <div className="card">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
