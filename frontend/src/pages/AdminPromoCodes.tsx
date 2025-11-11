import { useState } from "react";
import { PageHeader } from "../components/ui";
import { PlusIcon } from "@heroicons/react/24/outline";
import PromoCodeFilters from "../components/admin/promo-codes/PromoCodeFilters";
import PromoCodeList from "../components/admin/promo-codes/PromoCodeList";
import { usePromoCodeOperations } from "../hooks/usePromoCodeOperations";
import StaffCodeCreator from "../components/admin/promo-codes/StaffCodeCreator";
import RewardCodeCreator from "../components/admin/promo-codes/RewardCodeCreator";
import BundleConfigManager from "../components/admin/promo-codes/BundleConfigManager";

// ============================================================================
// Type Definitions
// ============================================================================

type AdminTabType = "all" | "create-staff" | "create-reward" | "bundle-config";
type PromoCodeTypeFilter =
  | "all"
  | "bundle_discount"
  | "staff_access"
  | "reward";
type PromoCodeStatusFilter = "all" | "active" | "used" | "expired";

// ============================================================================
// Main Component
// ============================================================================

export default function AdminPromoCodes() {
  const [activeTab, setActiveTab] = useState<AdminTabType>("all");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Promo Codes Management"
        subtitle="Manage promo codes, create staff access codes, and configure bundle discounts"
      />

      {/* Horizontal Tab Navigation */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="bg-gray-50 p-1">
          <nav className="flex gap-1">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-6 py-3 text-base font-medium rounded-md transition-all duration-200 focus:outline-none focus:ring-0 border-0 ${
                activeTab === "all"
                  ? "bg-white text-purple-600 shadow-md transform translate-y-0"
                  : "bg-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100/50 shadow-none transform translate-y-0.5"
              }`}
            >
              View All Codes
            </button>
            <button
              onClick={() => setActiveTab("create-staff")}
              className={`px-6 py-3 text-base font-medium rounded-md transition-all duration-200 flex items-center gap-2 focus:outline-none focus:ring-0 border-0 ${
                activeTab === "create-staff"
                  ? "bg-white text-purple-600 shadow-md transform translate-y-0"
                  : "bg-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100/50 shadow-none transform translate-y-0.5"
              }`}
            >
              <PlusIcon className="w-4 h-4" />
              Create Staff Code
            </button>
            <button
              onClick={() => setActiveTab("create-reward")}
              className={`px-6 py-3 text-base font-medium rounded-md transition-all duration-200 flex items-center gap-2 focus:outline-none focus:ring-0 border-0 ${
                activeTab === "create-reward"
                  ? "bg-white text-purple-600 shadow-md transform translate-y-0"
                  : "bg-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100/50 shadow-none transform translate-y-0.5"
              }`}
            >
              <PlusIcon className="w-4 h-4" />
              Create Reward Code
            </button>
            <button
              onClick={() => setActiveTab("bundle-config")}
              className={`px-6 py-3 text-base font-medium rounded-md transition-all duration-200 focus:outline-none focus:ring-0 border-0 ${
                activeTab === "bundle-config"
                  ? "bg-white text-purple-600 shadow-md transform translate-y-0"
                  : "bg-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100/50 shadow-none transform translate-y-0.5"
              }`}
            >
              Bundle Settings
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === "all" && <AllCodesTab />}
          {activeTab === "create-staff" && <StaffCodeCreator />}
          {activeTab === "create-reward" && <RewardCodeCreator />}
          {activeTab === "bundle-config" && <BundleConfigManager />}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// All Codes Tab (refactored - now uses extracted components)
// ============================================================================

function AllCodesTab() {
  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<PromoCodeTypeFilter>("all");
  const [statusFilter, setStatusFilter] =
    useState<PromoCodeStatusFilter>("all");

  const limit = 20;

  // Use the extracted hook for all operations
  const {
    codes,
    loading,
    error,
    totalCodes,
    totalPages,
    currentPage,
    setCurrentPage,
    deactivateCode,
    reactivateCode,
    copyCode,
    copiedCode,
  } = usePromoCodeOperations(typeFilter, statusFilter, searchQuery, limit);

  // Reset to page 1 when filters change
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleTypeFilterChange = (value: PromoCodeTypeFilter) => {
    setTypeFilter(value);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (value: PromoCodeStatusFilter) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <PromoCodeFilters
        searchQuery={searchQuery}
        typeFilter={typeFilter}
        statusFilter={statusFilter}
        totalCodes={totalCodes}
        onSearchChange={handleSearchChange}
        onTypeFilterChange={handleTypeFilterChange}
        onStatusFilterChange={handleStatusFilterChange}
      />

      {/* Promo Code List */}
      <PromoCodeList
        codes={codes}
        loading={loading}
        error={error}
        copiedCode={copiedCode}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        onCopyCode={copyCode}
        onDeactivate={deactivateCode}
        onReactivate={reactivateCode}
      />
    </div>
  );
}
