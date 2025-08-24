import { Link, useLocation, useNavigate } from "react-router-dom";
import { useCallback } from "react";
import {
  HomeIcon,
  CalendarDaysIcon,
  ClipboardDocumentListIcon,
  ArrowRightOnRectangleIcon,
} from "@heroicons/react/24/outline";

interface NavigationItem {
  name: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
}

interface GuestSidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export default function GuestSidebar({
  sidebarOpen,
  setSidebarOpen,
}: GuestSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const exitGuestMode = useCallback(() => {
    try {
      // Clear any transient guest state (future-proof; safe for guest-only layout)
      localStorage.removeItem("guestFormData");
      sessionStorage.clear();
      // Normalize history and redirect with a friendly message
      window.history.replaceState({}, "", "/");
      navigate("/login", {
        state: {
          message:
            "Thanks for visiting as a guest! You can create a free account anytime.",
        },
        replace: true,
      });
    } catch {
      // Best-effort: always navigate even if storage APIs fail
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  const navigationItems: NavigationItem[] = [
    { name: "Welcome", href: "/guest-dashboard/welcome", icon: HomeIcon },
    {
      name: "Upcoming Events",
      href: "/guest-dashboard/upcoming",
      icon: CalendarDaysIcon,
    },
    {
      name: "My Events",
      href: "/guest-dashboard/my-events",
      icon: ClipboardDocumentListIcon,
    },
    {
      name: "Exit Guest Registration",
      icon: ArrowRightOnRectangleIcon,
      onClick: exitGuestMode,
    },
  ];

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <nav
        className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-white shadow-sm border-r 
          transform transition-transform duration-300 ease-in-out lg:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="p-4 pt-20 h-full overflow-y-auto">
          <ul className="space-y-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.href && location.pathname === item.href;
              return (
                <li key={item.name}>
                  {item.href ? (
                    <Link
                      to={item.href}
                      className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                        isActive
                          ? "bg-blue-50 text-blue-700 border-r-2 border-blue-700"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <span className="font-medium">{item.name}</span>
                    </Link>
                  ) : (
                    <button
                      onClick={() => {
                        setSidebarOpen(false);
                        item.onClick?.();
                      }}
                      className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors text-gray-700 hover:bg-gray-50"
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <span className="font-medium">{item.name}</span>
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
      {null}
    </>
  );
}
