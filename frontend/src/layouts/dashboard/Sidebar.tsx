import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import ConfirmLogoutModal from "../../components/common/ConfirmLogoutModal";
import {
  CalendarDaysIcon,
  CalendarIcon,
  ArrowRightOnRectangleIcon,
  PlusIcon,
  UsersIcon,
  HomeIcon,
  SpeakerWaveIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  ComputerDesktopIcon,
  ChatBubbleLeftRightIcon,
  RectangleStackIcon,
  GlobeAltIcon,
  ShieldCheckIcon,
  DocumentDuplicateIcon,
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
  const location = useLocation(); //获取当前路径
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  const handleLogout = async () => {
    try {
      setLogoutLoading(true);
      await logout();
      navigate("/");
    } finally {
      setLogoutLoading(false);
    }
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
        name: "Programs",
        href: "/dashboard/programs",
        icon: RectangleStackIcon,
      },
      {
        name: "Upcoming Events",
        href: "/dashboard/upcoming",
        icon: CalendarDaysIcon,
      },
      { name: "Past Events", href: "/dashboard/passed", icon: CalendarIcon },
      {
        name: "My Events",
        href: "/dashboard/my-events",
        icon: ClipboardDocumentListIcon,
      },
    ];

    // Add Published Events for Super Admin and Administrator only
    if (userRole === "Super Admin" || userRole === "Administrator") {
      baseItems.push({
        name: "Published Events",
        href: "/dashboard/published-events",
        icon: GlobeAltIcon,
      });
    }

    // Add role-specific items according to requirements
    if (userRole === "Super Admin" || userRole === "Administrator") {
      baseItems.push(
        {
          name: "Create Event",
          href: "/dashboard/event-config",
          icon: PlusIcon,
        },
        {
          name: "Role Templates",
          href: "/dashboard/configure-roles-templates",
          icon: DocumentDuplicateIcon,
        },
        { name: "Management", href: "/dashboard/management", icon: UsersIcon }
      );
    } else if (userRole === "Leader") {
      baseItems.push(
        {
          name: "Create Event",
          href: "/dashboard/event-config",
          icon: PlusIcon,
        },
        {
          name: "Role Templates",
          href: "/dashboard/configure-roles-templates",
          icon: DocumentDuplicateIcon,
        },
        { name: "Community", href: "/dashboard/management", icon: UsersIcon }
      );
    } else if (userRole === "Participant" || userRole === "Guest Expert") {
      // Participants can now see Create Event (with on-page access notice) and Community
      baseItems.push(
        {
          name: "Create Event",
          href: "/dashboard/event-config",
          icon: PlusIcon,
        },
        {
          name: "Community",
          href: "/dashboard/management",
          icon: UsersIcon,
        }
      );
    }

    // Add System Messages for all logged-in users
    baseItems.push({
      name: "System Messages",
      href: "/dashboard/system-messages",
      icon: SpeakerWaveIcon,
    });

    // Add Analytics for all roles (page handles access notice for Participants)
    if (
      userRole === "Super Admin" ||
      userRole === "Administrator" ||
      userRole === "Leader" ||
      userRole === "Participant" ||
      userRole === "Guest Expert"
    ) {
      baseItems.push({
        name: "Analytics",
        href: "/dashboard/analytics",
        icon: ChartBarIcon,
      });
    }

    // Add System Monitoring for Super Admin only
    if (userRole === "Super Admin") {
      baseItems.push({
        name: "System Monitor",
        href: "/dashboard/monitor",
        icon: ComputerDesktopIcon,
      });
    }

    // Add Audit Logs for Super Admin and Administrator
    if (userRole === "Super Admin" || userRole === "Administrator") {
      baseItems.push({
        name: "Audit Logs",
        href: "/dashboard/audit-logs",
        icon: ShieldCheckIcon,
      });
    }

    // Add Feedback for all users (above Log Out)
    baseItems.push({
      name: "Feedback",
      href: "/dashboard/feedback",
      icon: ChatBubbleLeftRightIcon,
    });

    baseItems.push({
      name: "Log Out",
      icon: ArrowRightOnRectangleIcon,
      onClick: () => setShowLogoutConfirm(true),
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
      <ConfirmLogoutModal
        open={showLogoutConfirm}
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={() => {
          setShowLogoutConfirm(false);
          void handleLogout();
        }}
        loading={logoutLoading}
      />
    </>
  );
}
