import { useState } from "react";
import { Header, Sidebar } from "./dashboard";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Mock user data - this should come from auth context
  const currentUser = {
    firstName: "John",
    lastName: "Doe",
    username: "john_doe",
    systemRole: "Administrator",
    gender: "male" as "male" | "female",
    customAvatar: null as string | null,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        user={currentUser}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      <div className="flex">
        <Sidebar
          userRole={currentUser.systemRole}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />

        {/* Main Content */}
        <main className="flex-1 w-full lg:ml-0">
          <div className="p-4 sm:p-6 max-w-none">{children}</div>
        </main>
      </div>
    </div>
  );
}
