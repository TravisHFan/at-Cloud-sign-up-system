import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import DefaultAvatar from './DefaultAvatar';

interface User {
  firstName: string;
  lastName: string;
  username: string;
  systemRole: string;
  gender: "male" | "female";
  customAvatar: string | null;
}

interface UserDropdownProps {
  user: User;
}

export default function UserDropdown({ user }: UserDropdownProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const handleLogout = () => {
    // Handle logout logic here
    navigate("/login");
  };

  return (
    <div className="relative flex-shrink-0" ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center space-x-2 sm:space-x-3 text-gray-700 hover:text-gray-900 p-2 rounded-lg hover:bg-gray-50 transition-colors"
      >
        {user.customAvatar ? (
          <img
            className="h-8 w-8 rounded-full"
            src={user.customAvatar}
            alt="Avatar"
          />
        ) : (
          <DefaultAvatar gender={user.gender} size={32} />
        )}
        <div className="text-right hidden sm:block">
          <div className="text-sm font-medium text-gray-900 truncate max-w-24 lg:max-w-none">
            {user.username}
          </div>
          <div className="text-xs text-gray-500">
            {user.systemRole}
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
  );
}