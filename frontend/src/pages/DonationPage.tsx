import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  PlusIcon,
  DocumentTextIcon,
  ArrowRightOnRectangleIcon,
} from "@heroicons/react/24/outline";
import GivingTab from "../components/donations/GivingTab";
import ScheduledTab from "../components/donations/ScheduledTab";
import GiveModal from "../components/donations/GiveModal";
import { useAuth } from "../hooks/useAuth";

type TabType = "giving" | "scheduled";

export default function DonationPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("giving");
  const [isGiveModalOpen, setIsGiveModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Handle success callback from Stripe
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get("success");

    if (success === "true") {
      // Trigger refresh of the giving tab
      setRefreshKey((prev) => prev + 1);
      setActiveTab("giving");

      // Clean up URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Donation to Our Ministry
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Support our mission to expand God's kingdom in the marketplace
        </p>
      </div>

      {/* Give Button */}
      <div className="flex gap-3">
        <button
          onClick={() => setIsGiveModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm hover:shadow-md"
        >
          <PlusIcon className="w-5 h-5" />
          <span>Give</span>
        </button>

        <button
          onClick={() => navigate("/dashboard/donation-receipt")}
          className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm hover:shadow-md"
        >
          <DocumentTextIcon className="w-5 h-5" />
          <span>Get Receipt</span>
        </button>

        {/* Login Button - Only show if user is not logged in */}
        {!currentUser && (
          <button
            onClick={() => {
              // Store return URL in sessionStorage
              sessionStorage.setItem("returnUrl", "/dashboard/donate");
              navigate("/login");
            }}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm hover:shadow-md ml-auto"
          >
            <ArrowRightOnRectangleIcon className="w-5 h-5" />
            <span>Login for History</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {/* Tab Headers */}
        <div className="border-b border-gray-200">
          <nav
            className="flex gap-0 px-4 pt-4"
            role="tablist"
            aria-label="Tabs"
          >
            <button
              onClick={() => setActiveTab("giving")}
              className={`
                flex-1 py-3 px-4 text-center font-medium text-sm transition-all duration-200 focus:outline-none focus:ring-0 border-t border-x rounded-t-lg rounded-b-none
                ${
                  activeTab === "giving"
                    ? "bg-white text-blue-600 border-gray-200 border-b-white -mb-px relative z-10"
                    : "bg-gray-100 text-gray-600 hover:text-gray-900 hover:bg-gray-200 border-gray-200"
                }
              `}
            >
              Giving
            </button>
            <button
              onClick={() => setActiveTab("scheduled")}
              className={`
                flex-1 py-3 px-4 text-center font-medium text-sm transition-all duration-200 focus:outline-none focus:ring-0 border-t border-x rounded-t-lg rounded-b-none
                ${
                  activeTab === "scheduled"
                    ? "bg-white text-blue-600 border-gray-200 border-b-white -mb-px relative z-10"
                    : "bg-gray-100 text-gray-600 hover:text-gray-900 hover:bg-gray-200 border-gray-200"
                }
              `}
            >
              Scheduled
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === "giving" && <GivingTab key={refreshKey} />}
          {activeTab === "scheduled" && <ScheduledTab />}
        </div>
      </div>

      {/* Give Modal */}
      <GiveModal
        isOpen={isGiveModalOpen}
        onClose={() => setIsGiveModalOpen(false)}
      />
    </div>
  );
}
