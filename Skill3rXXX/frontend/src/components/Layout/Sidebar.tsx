/**
 * Sidebar navigation with collapsible mode.
 */
import { NavLink } from "react-router-dom";
import { useUiStore } from "../../store";

interface NavItem {
  to: string;
  label: string;
  icon: string; // emoji for simplicity; replace with icon library
}

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard",      label: "Dashboard",      icon: "📊" },
  { to: "/products",       label: "Products",        icon: "📦" },
  { to: "/subscriptions",  label: "Subscriptions",   icon: "🔄" },
  { to: "/affiliates",     label: "Affiliates",       icon: "🔗" },
  { to: "/content",        label: "Content",          icon: "✍️" },
  { to: "/analytics",      label: "Analytics",        icon: "📈" },
];

export default function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useUiStore();

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-gray-900 border-r border-gray-800 z-50
                  transition-all duration-300 flex flex-col
                  ${sidebarOpen ? "w-64" : "w-20"}`}
    >
      {/* Logo */}
      <div className="flex items-center justify-between p-5 border-b border-gray-800">
        {sidebarOpen && (
          <div className="flex items-center gap-2">
            <span className="text-2xl">💰</span>
            <span className="font-bold text-white text-lg">PIMS</span>
          </div>
        )}
        {!sidebarOpen && <span className="text-2xl mx-auto">💰</span>}
        <button
          onClick={toggleSidebar}
          className="text-gray-400 hover:text-white transition-colors p-1"
          aria-label="Toggle sidebar"
        >
          {sidebarOpen ? "←" : "→"}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-5 py-3 text-sm font-medium transition-colors
               ${isActive
                 ? "bg-brand-500/10 text-brand-400 border-r-2 border-brand-500"
                 : "text-gray-400 hover:text-white hover:bg-gray-800"
               }`
            }
          >
            <span className="text-xl flex-shrink-0">{item.icon}</span>
            {sidebarOpen && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Version badge */}
      {sidebarOpen && (
        <div className="p-4 border-t border-gray-800">
          <p className="text-xs text-gray-500 text-center">PIMS v1.0.0</p>
        </div>
      )}
    </aside>
  );
}
