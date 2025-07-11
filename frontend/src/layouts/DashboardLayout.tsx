import { useState } from "react";
import { Header, Sidebar } from "./dashboard";
import { useAuth } from "../hooks/useAuth";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { currentUser } = useAuth();

  // Default fallback if no user is logged in (shouldn't happen in protected routes)
  const user = currentUser || {
    firstName: "Guest",
    lastName: "User",
    username: "guest",
    role: "Participant",
    gender: "male" as "male" | "female",
    avatar: null as string | null,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Fixed Header */}
      <Header
        user={{
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
          systemRole: user.role,
          gender: user.gender,
          avatar: user.avatar || null,
        }}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      <div className="flex h-screen pt-16">
        {/* Fixed Sidebar */}
        <Sidebar
          userRole={user.role}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />

        {/* Scrollable Main Content */}
        <main className="flex-1 overflow-y-auto lg:ml-64">
          <div className="p-4 sm:p-6 max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
