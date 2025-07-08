import { useState, useEffect, useRef } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  CalendarDaysIcon,
  CalendarIcon,
  ArrowRightOnRectangleIcon,
  PlusIcon,
  UsersIcon,
  ChevronDownIcon,
  Bars3Icon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Mock user data - this should come from auth context
  const currentUser = {
    firstName: "John",
    lastName: "Doe",
    username: "john_doe",
    systemRole: "Administrator",
    gender: "male" as "male" | "female",
    customAvatar: null as string | null,
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Default Avatar Component
  const DefaultAvatar = ({
    gender,
    size = 32,
  }: {
    gender: "male" | "female";
    size?: number;
  }) => {
    const bgColor = gender === "male" ? "bg-blue-500" : "bg-pink-500";
    const initial = gender === "male" ? "M" : "F";

    return (
      <div
        className={`${bgColor} text-white rounded-full flex items-center justify-center font-bold`}
        style={{ width: size, height: size, fontSize: size / 2.5 }}
      >
        {initial}
      </div>
    );
  };

  const handleLogout = () => {
    // Handle logout logic here
    navigate("/login");
  };

  // Navigation items based on user role
  const getNavigationItems = () => {
    const baseItems = [
      {
        name: "Upcoming Events",
        href: "/dashboard/upcoming",
        icon: CalendarDaysIcon,
      },
      { name: "Passed Events", href: "/dashboard/passed", icon: CalendarIcon },
    ];

    // Add role-specific items
    if (
      currentUser.systemRole === "Owner" ||
      currentUser.systemRole === "Administrator"
    ) {
      baseItems.push(
        { name: "Management", href: "/dashboard/management", icon: UsersIcon },
        {
          name: "New Event",
          href: "/dashboard/new-event",
          icon: PlusIcon,
        }
      );
    } else if (currentUser.systemRole === "Director") {
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
    <div className="min-h-screen bg-gray-50">
      {/* Header - Fixed responsive design */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="w-full max-w-none px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left section: Mobile menu button + Logo */}
            <div className="flex items-center space-x-4">
              {/* Mobile menu button */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {sidebarOpen ? (
                  <XMarkIcon className="h-6 w-6" />
                ) : (
                  <Bars3Icon className="h-6 w-6" />
                )}
              </button>

              {/* Logo and Organization */}
              <div className="flex items-center space-x-3">
                <img
                  src="/@Cloud.jpg"
                  alt="@Cloud Logo"
                  className="h-10 w-10 sm:h-12 sm:w-12 object-contain flex-shrink-0"
                />
                <div className="text-lg sm:text-xl font-bold text-gray-900 truncate">
                  @Cloud Marketplace Ministry
                </div>
              </div>
            </div>

            {/* Right section: User Avatar and Dropdown - Always flush right */}
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center space-x-2 sm:space-x-3 text-gray-700 hover:text-gray-900 p-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {currentUser.customAvatar ? (
                  <img
                    className="h-8 w-8 rounded-full"
                    src={currentUser.customAvatar}
                    alt="Avatar"
                  />
                ) : (
                  <DefaultAvatar gender={currentUser.gender} size={32} />
                )}
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-medium text-gray-900 truncate max-w-24 lg:max-w-none">
                    {currentUser.username}
                  </div>
                  <div className="text-xs text-gray-500">
                    {currentUser.systemRole}
                  </div>
                </div>
                <ChevronDownIcon className="w-4 h-4 flex-shrink-0" />
              </button>

              {/* Dropdown Menu */}
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                  <div className="py-1">
                    <Link
                      to="/dashboard/profile"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setDropdownOpen(false)}
                    >
                      Profile
                    </Link>
                    <Link
                      to="/dashboard/change-password"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setDropdownOpen(false)}
                    >
                      Change Password
                    </Link>
                    <Link
                      to="/logout"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => {
                        setDropdownOpen(false);
                        handleLogout();
                      }}
                    >
                      Log Out
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
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

        {/* Main Content */}
        <main className="flex-1 w-full lg:ml-0">
          <div className="p-4 sm:p-6 max-w-none">{children}</div>
        </main>
      </div>
    </div>
  );
}
