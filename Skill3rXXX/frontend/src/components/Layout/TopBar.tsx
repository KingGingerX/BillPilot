import { useAuthStore } from "../../store";
import { useLogout } from "../../hooks/useAuth";

export default function TopBar() {
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();

  return (
    <header className="h-16 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6 flex-shrink-0">
      <h1 className="text-lg font-semibold text-white">
        Passive Income Master System
      </h1>

      <div className="flex items-center gap-4">
        {/* User avatar */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white text-sm font-bold">
            {user?.firstName?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-white">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-gray-400">{user?.role}</p>
          </div>
        </div>

        <button
          onClick={logout}
          className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-800"
        >
          Log out
        </button>
      </div>
    </header>
  );
}
