import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  CalendarDaysIcon, 
  CalendarIcon, 
  ArrowRightOnRectangleIcon,
  PlusIcon,
  UsersIcon,
  UserCircleIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const location = useLocation();

  // Mock user data - this will come from authentication context later
  const mockUser = {
    username: "john_doe",
    role: "Administrator", // Owner, Administrator, Director, User
    avatar: "/api/placeholder/40/40"
  };

  // Navigation items based on user role
  const getNavItems = () => {
    const baseItems = [
      { name: 'Upcoming Events', href: '/dashboard/upcoming', icon: CalendarDaysIcon },
      { name: 'Passed Events', href: '/dashboard/passed', icon: CalendarIcon },
    ];

    // Add role-specific items
    if (mockUser.role === 'Owner' || mockUser.role === 'Administrator') {
      baseItems.push(
        { name: 'Management', href: '/dashboard/management', icon: UsersIcon },
        { name: 'New Event', href: '/dashboard/new-event', icon: PlusIcon }
      );
    } else if (mockUser.role === 'Director') {
      baseItems.push(
        { name: 'New Event', href: '/dashboard/new-event', icon: PlusIcon }
      );
    }

    baseItems.push(
      { name: 'Log Out', href: '/logout', icon: ArrowRightOnRectangleIcon }
    );

    return baseItems;
  };

  const navItems = getNavItems();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo and Organization */}
            <div className="flex items-center space-x-4">
              <div className="text-2xl font-bold text-blue-600">@Cloud</div>
              <div className="text-lg text-gray-600">Organization</div>
            </div>

            {/* User Avatar and Dropdown */}
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center space-x-3 text-gray-700 hover:text-gray-900"
              >
                <img
                  src={mockUser.avatar}
                  alt="User Avatar"
                  className="w-10 h-10 rounded-full border-2 border-gray-300"
                />
                <div className="text-right">
                  <div className="text-sm font-medium">{mockUser.username}</div>
                  <div className="text-xs text-gray-500">{mockUser.role}</div>
                </div>
                <ChevronDownIcon className="w-4 h-4" />
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
                      onClick={() => setDropdownOpen(false)}
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
        {/* Sidebar */}
        <nav className="w-64 bg-white shadow-sm border-r min-h-screen">
          <div className="p-4">
            <ul className="space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;
                
                return (
                  <li key={item.name}>
                    <Link
                      to={item.href}
                      className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{item.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}