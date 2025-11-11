import { useState, useEffect } from "react";
import { PlusIcon } from "@heroicons/react/24/outline";
import GivingTab from "../components/donations/GivingTab";
import ScheduledTab from "../components/donations/ScheduledTab";
import GiveModal from "../components/donations/GiveModal";

type TabType = "giving" | "scheduled";

export default function DonationPage() {
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
      <div>
        <button
          onClick={() => setIsGiveModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm hover:shadow-md"
        >
          <PlusIcon className="w-5 h-5" />
          <span>Give</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {/* Tab Headers */}
        <div className="bg-gray-50 p-1">
          <nav className="flex gap-1" aria-label="Tabs">
            <button
              onClick={() => setActiveTab("giving")}
              className={`
                flex-1 py-3 px-4 text-center font-medium text-sm rounded-md transition-all duration-200 focus:outline-none focus:ring-0 border-0
                ${
                  activeTab === "giving"
                    ? "bg-white text-blue-600 shadow-md transform translate-y-0"
                    : "bg-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100/50 shadow-none transform translate-y-0.5"
                }
              `}
            >
              Giving
            </button>
            <button
              onClick={() => setActiveTab("scheduled")}
              className={`
                flex-1 py-3 px-4 text-center font-medium text-sm rounded-md transition-all duration-200 focus:outline-none focus:ring-0 border-0
                ${
                  activeTab === "scheduled"
                    ? "bg-white text-blue-600 shadow-md transform translate-y-0"
                    : "bg-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100/50 shadow-none transform translate-y-0.5"
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
