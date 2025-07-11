import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  CalendarDaysIcon,
  CalendarIcon,
  ArrowRightOnRectangleIcon,
  PlusIcon,
  UsersIcon,
  HomeIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "../../hooks/useAuth";

interface NavigationItem {
  name: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
}

interface SidebarProps {
  userRole: string;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export default function Sidebar({
  userRole,
  sidebarOpen,
  setSidebarOpen,
}: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  // Navigation items based on user role
  const getNavigationItems = (): NavigationItem[] => {
    const baseItems: NavigationItem[] = [
      // Welcome as the first item
      {
        name: "Welcome",
        href: "/dashboard/welcome",
        icon: HomeIcon,
      },
      {
        name: "Upcoming Events",
        href: "/dashboard/upcoming",
        icon: CalendarDaysIcon,
      },
      { name: "Passed Events", href: "/dashboard/passed", icon: CalendarIcon },
    ];

    // Add role-specific items
    if (userRole === "Owner" || userRole === "Administrator") {
      baseItems.push(
        { name: "Management", href: "/dashboard/management", icon: UsersIcon },
        {
          name: "New Event",
          href: "/dashboard/new-event",
          icon: PlusIcon,
        }
      );
    } else if (userRole === "Director") {
      baseItems.push({
        name: "New Event",
        href: "/dashboard/new-event",
        icon: PlusIcon,
      });
    }

    baseItems.push({
      name: "Log Out",
      icon: ArrowRightOnRectangleIcon,
      onClick: handleLogout,
    });

    return baseItems;
  };

  const navigationItems = getNavigationItems();

  return (
    <>
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
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
              const isActive =
                item.href &&
                (location.pathname === item.href ||
                  (item.href === "/dashboard/welcome" &&
                    location.pathname === "/dashboard"));

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
                      onClick={() => setSidebarOpen(false)} // Close mobile menu on click
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
    </>
  );
}
