import { Link, useLocation } from 'react-router-dom';
import {
  CalendarDaysIcon,
  CalendarIcon,
  ArrowRightOnRectangleIcon,
  PlusIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface SidebarProps {
  userRole: string;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export default function Sidebar({ userRole, sidebarOpen, setSidebarOpen }: SidebarProps) {
  const location = useLocation();

  // Navigation items based on user role
  const getNavigationItems = (): NavigationItem[] => {
    const baseItems: NavigationItem[] = [
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
      href: "/logout",
      icon: ArrowRightOnRectangleIcon,
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
          fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white shadow-sm border-r 
          transform transition-transform duration-300 ease-in-out lg:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="p-4 pt-20 lg:pt-4">
          <ul className="space-y-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;

              return (
                <li key={item.name}>
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
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
    </>
  );
}