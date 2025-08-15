import { useState } from "react";
import { useLocation, Outlet, Navigate } from "react-router-dom";
import { Header, Sidebar } from "./dashboard";
import { Footer } from "../components/common";
import { useAuth } from "../hooks/useAuth";
import LoadingSpinner from "../components/common/LoadingSpinner";

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { currentUser, isLoading } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return <LoadingSpinner message="Loading dashboard..." />;
  }

  // Redirect to login if user is not authenticated
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  const user = currentUser;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Fixed Header */}
      <Header
        user={{
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
          systemAuthorizationLevel: user.role,
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
        <main
          className="flex-1 overflow-y-auto lg:ml-64"
          key={`main-${location.pathname}`}
        >
          <div className="min-h-full flex flex-col">
            {/** Allow wider content specifically on Management page to fit all table columns */}
            <div
              className={`flex-1 p-4 sm:p-6 ${
                location.pathname.startsWith("/dashboard/management")
                  ? "max-w-[1280px] xl:max-w-[1360px] 2xl:max-w-[1440px]"
                  : "max-w-7xl"
              } mx-auto w-full`}
            >
              <Outlet key={location.pathname} />
            </div>
            <Footer />
          </div>
        </main>
      </div>
    </div>
  );
}
