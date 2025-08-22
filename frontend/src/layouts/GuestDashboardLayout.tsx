import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import GuestHeader from "./guest/GuestHeader";
import GuestSidebar from "./guest/GuestSidebar";
import { Footer } from "../components/common";

export default function GuestDashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-50">
      <GuestHeader sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="flex h-screen pt-16">
        <GuestSidebar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />
        <main
          className="flex-1 overflow-y-auto lg:ml-64"
          key={`guest-main-${location.pathname}`}
        >
          <div className="min-h-full flex flex-col">
            <div className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full">
              <Outlet key={location.pathname} />
            </div>
            <Footer />
          </div>
        </main>
      </div>
    </div>
  );
}
