import { useState } from "react";
import { PageHeader } from "../components/ui";
import { PlusIcon } from "@heroicons/react/24/outline";

type AdminTabType = "all" | "create-staff" | "bundle-config";

export default function AdminPromoCodes() {
  const [activeTab, setActiveTab] = useState<AdminTabType>("all");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Promo Codes Management"
        subtitle="Manage promo codes, create staff access codes, and configure bundle discounts"
      />

      {/* Horizontal Tab Navigation */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "all"
                  ? "border-purple-600 text-purple-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              View All Codes
            </button>
            <button
              onClick={() => setActiveTab("create-staff")}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === "create-staff"
                  ? "border-purple-600 text-purple-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <PlusIcon className="w-4 h-4" />
              Create Staff Code
            </button>
            <button
              onClick={() => setActiveTab("bundle-config")}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "bundle-config"
                  ? "border-purple-600 text-purple-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Bundle Settings
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === "all" && <AllCodesTab />}
          {activeTab === "create-staff" && <CreateStaffCodeTab />}
          {activeTab === "bundle-config" && <BundleConfigTab />}
        </div>
      </div>
    </div>
  );
}

// Tab 1: View All Codes
function AllCodesTab() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">All Promo Codes</h2>
        <div className="text-sm text-gray-500">Coming in Phase 3</div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
        <div className="text-6xl mb-4">🎫</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Admin Promo Code Management
        </h3>
        <p className="text-gray-600 mb-4">
          This page will display all promo codes in the system with filters,
          search, and export capabilities.
        </p>
        <p className="text-sm text-gray-500">
          <strong>Phase 3 Implementation:</strong> Todos #19-23
        </p>
        <div className="mt-4 text-left bg-white rounded-lg p-4 max-w-2xl mx-auto">
          <p className="text-sm font-medium text-gray-700 mb-2">
            Features to be implemented:
          </p>
          <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
            <li>View all promo codes (bundle + staff access)</li>
            <li>Filter by type, status, owner</li>
            <li>Search by code or user</li>
            <li>Paginated table view</li>
            <li>Quick copy functionality</li>
            <li>Deactivate codes</li>
            <li>Export to CSV</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// Tab 2: Create Staff Access Code
function CreateStaffCodeTab() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Create Staff Access Code
        </h2>
        <div className="text-sm text-gray-500">Coming in Phase 3</div>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
        <div className="text-6xl mb-4">🎁</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Generate 100% Off Codes
        </h3>
        <p className="text-gray-600 mb-4">
          This page will allow admins to create staff access codes (100% off)
          for volunteers and special guests.
        </p>
        <p className="text-sm text-gray-500">
          <strong>Phase 3 Implementation:</strong> Todo #19-20
        </p>
        <div className="mt-4 text-left bg-white rounded-lg p-4 max-w-2xl mx-auto">
          <p className="text-sm font-medium text-gray-700 mb-2">
            Features to be implemented:
          </p>
          <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
            <li>Select user from searchable dropdown</li>
            <li>Choose all programs or specific ones</li>
            <li>Set expiration date (optional)</li>
            <li>Auto-generate unique 8-character code</li>
            <li>Send email notification to user</li>
            <li>Success confirmation with code display</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// Tab 3: Bundle Discount Configuration
function BundleConfigTab() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Bundle Discount Settings
        </h2>
        <div className="text-sm text-gray-500">Coming in Phase 3</div>
      </div>

      <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 text-center">
        <div className="text-6xl mb-4">⚙️</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Configure Bundle Codes
        </h3>
        <p className="text-gray-600 mb-4">
          This page will allow admins to configure the bundle discount amount
          and enable/disable the feature.
        </p>
        <p className="text-sm text-gray-500">
          <strong>Phase 3 Implementation:</strong> Todo #23
        </p>
        <div className="mt-4 text-left bg-white rounded-lg p-4 max-w-2xl mx-auto">
          <p className="text-sm font-medium text-gray-700 mb-2">
            Features to be implemented:
          </p>
          <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
            <li>Enable/disable bundle code generation</li>
            <li>Set discount amount ($30-$200 slider)</li>
            <li>Set expiration period (30/60/90 days)</li>
            <li>Preview discount impact</li>
            <li>Save configuration</li>
            <li>View current settings</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
