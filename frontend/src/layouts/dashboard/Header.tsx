import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import UserDropdown from "./UserDropdown";
import { NotificationDropdown } from "../../components/common";

interface User {
  firstName: string;
  lastName: string;
  username: string;
  systemRole: string;
  gender: "male" | "female";
  avatar: string | null;
}

interface HeaderProps {
  user: User;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export default function Header({
  user,
  sidebarOpen,
  setSidebarOpen,
}: HeaderProps) {
  return (
    <header className="bg-white shadow-sm border-b fixed top-0 left-0 right-0 z-50">
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

          {/* Right section: Notifications + User Avatar and Dropdown */}
          <div className="flex items-center space-x-4">
            <NotificationDropdown />
            <UserDropdown user={user} />
          </div>
        </div>
      </div>
    </header>
  );
}
