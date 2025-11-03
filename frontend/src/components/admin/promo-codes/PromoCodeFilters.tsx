import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";

export type PromoCodeTypeFilter = "all" | "bundle_discount" | "staff_access";
export type PromoCodeStatusFilter = "all" | "active" | "used" | "expired";

export interface PromoCodeFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  typeFilter: PromoCodeTypeFilter;
  onTypeFilterChange: (type: PromoCodeTypeFilter) => void;
  statusFilter: PromoCodeStatusFilter;
  onStatusFilterChange: (status: PromoCodeStatusFilter) => void;
  totalCodes: number;
  onPageReset?: () => void; // Optional callback to reset pagination
}

export default function PromoCodeFilters({
  searchQuery,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  statusFilter,
  onStatusFilterChange,
  totalCodes,
  onPageReset,
}: PromoCodeFiltersProps) {
  const handleSearchChange = (value: string) => {
    onSearchChange(value);
    onPageReset?.(); // Reset to first page when search changes
  };

  const handleTypeChange = (type: PromoCodeTypeFilter) => {
    onTypeFilterChange(type);
    onPageReset?.(); // Reset to first page when filter changes
  };

  const handleStatusChange = (status: PromoCodeStatusFilter) => {
    onStatusFilterChange(status);
    onPageReset?.(); // Reset to first page when filter changes
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            All Promo Codes
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {totalCodes} {totalCodes === 1 ? "code" : "codes"} total
          </p>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="flex flex-wrap gap-4 items-end">
        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Search
          </label>
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by code or owner..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Type Filter */}
        <div className="min-w-[150px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Type
          </label>
          <select
            value={typeFilter}
            onChange={(e) =>
              handleTypeChange(e.target.value as PromoCodeTypeFilter)
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="all">All Types</option>
            <option value="bundle_discount">Bundle Discount</option>
            <option value="staff_access">Staff Access</option>
          </select>
        </div>

        {/* Status Filter */}
        <div className="min-w-[150px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) =>
              handleStatusChange(e.target.value as PromoCodeStatusFilter)
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="used">Used</option>
            <option value="expired">Expired</option>
          </select>
        </div>
      </div>
    </div>
  );
}
