import { useState, useEffect } from "react";
import {
  PageHeader,
  Badge,
  LoadingSpinner,
  EmptyState,
  Button,
} from "../components/ui";
import {
  PlusIcon,
  MagnifyingGlassIcon,
  ClipboardDocumentIcon,
  XMarkIcon,
  UserIcon,
  CalendarIcon,
} from "@heroicons/react/24/outline";
import { CheckIcon } from "@heroicons/react/24/solid";
import { apiClient } from "../services/api";
import { formatDistanceToNow } from "date-fns";
import ConfirmationModal from "../components/common/ConfirmationModal";

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
  const [codes, setCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState<
    "all" | "bundle_discount" | "staff_access"
  >("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "used" | "expired"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCodes, setTotalCodes] = useState(0);
  const limit = 20;

  // Copy feedback
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Deactivate confirmation modal state
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [codeToDeactivate, setCodeToDeactivate] = useState<{
    id: string;
    code: string;
  } | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);

  // Reactivate confirmation modal state
  const [showReactivateModal, setShowReactivateModal] = useState(false);
  const [codeToReactivate, setCodeToReactivate] = useState<{
    id: string;
    code: string;
  } | null>(null);
  const [isReactivating, setIsReactivating] = useState(false);

  // Fetch codes
  useEffect(() => {
    fetchCodes();
  }, [typeFilter, statusFilter, searchQuery, currentPage]);

  const fetchCodes = async () => {
    try {
      setLoading(true);
      setError(null);

      const filters: any = {
        page: currentPage,
        limit,
      };

      if (typeFilter !== "all") filters.type = typeFilter;
      if (statusFilter !== "all") filters.status = statusFilter;
      if (searchQuery.trim()) filters.search = searchQuery.trim();

      const response = await apiClient.getAllPromoCodes(filters);

      setCodes(response.codes);
      setTotalPages(response.pagination.totalPages);
      setTotalCodes(response.pagination.total);
    } catch (err: any) {
      setError(err.message || "Failed to fetch promo codes");
      setCodes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error("Failed to copy code:", err);
    }
  };

  const handleDeactivate = async (codeId: string, code: string) => {
    setCodeToDeactivate({ id: codeId, code });
    setShowDeactivateModal(true);
  };

  const confirmDeactivate = async () => {
    if (!codeToDeactivate) return;

    try {
      setIsDeactivating(true);
      await apiClient.deactivatePromoCode(codeToDeactivate.id);
      fetchCodes(); // Refresh list
      setShowDeactivateModal(false);
      setCodeToDeactivate(null);
    } catch (err: any) {
      alert(`Failed to deactivate code: ${err.message}`);
    } finally {
      setIsDeactivating(false);
    }
  };

  const cancelDeactivate = () => {
    setShowDeactivateModal(false);
    setCodeToDeactivate(null);
  };

  const handleReactivate = async (codeId: string, code: string) => {
    setCodeToReactivate({ id: codeId, code });
    setShowReactivateModal(true);
  };

  const confirmReactivate = async () => {
    if (!codeToReactivate) return;

    try {
      setIsReactivating(true);
      await apiClient.reactivatePromoCode(codeToReactivate.id);
      fetchCodes(); // Refresh list
      setShowReactivateModal(false);
      setCodeToReactivate(null);
    } catch (err: any) {
      alert(`Failed to reactivate code: ${err.message}`);
    } finally {
      setIsReactivating(false);
    }
  };

  const cancelReactivate = () => {
    setShowReactivateModal(false);
    setCodeToReactivate(null);
  };

  const getStatusBadge = (promoCode: any) => {
    const now = new Date();
    const isExpired =
      promoCode.expiresAt && new Date(promoCode.expiresAt) < now;

    if (promoCode.isUsed) {
      return <Badge variant="success">Used</Badge>;
    } else if (isExpired) {
      return <Badge variant="error">Expired</Badge>;
    } else if (promoCode.isActive) {
      return <Badge variant="info">Active</Badge>;
    } else {
      return <Badge variant="neutral">Inactive</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    return type === "bundle_discount" ? (
      <Badge variant="purple">Bundle</Badge>
    ) : (
      <Badge variant="info">Staff Access</Badge>
    );
  };

  const formatDiscount = (promoCode: any) => {
    if (promoCode.discountPercent) {
      return `${promoCode.discountPercent}% off`;
    } else if (promoCode.discountAmount) {
      return `$${(promoCode.discountAmount / 100).toFixed(0)} off`;
    }
    return "—";
  };

  const formatExpiry = (expiresAt?: string) => {
    if (!expiresAt) return "Never";
    const date = new Date(expiresAt);
    const now = new Date();

    if (date < now) {
      return (
        <span className="text-red-600">
          Expired {formatDistanceToNow(date)} ago
        </span>
      );
    }
    return (
      <span className="text-gray-600">in {formatDistanceToNow(date)}</span>
    );
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

      {/* Filters */}
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
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1); // Reset to first page
              }}
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
            onChange={(e) => {
              setTypeFilter(e.target.value as any);
              setCurrentPage(1);
            }}
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
            onChange={(e) => {
              setStatusFilter(e.target.value as any);
              setCurrentPage(1);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="used">Used</option>
            <option value="expired">Expired</option>
          </select>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && codes.length === 0 && (
        <EmptyState
          icon="🎫"
          title="No promo codes found"
          message={
            searchQuery || typeFilter !== "all" || statusFilter !== "all"
              ? "Try adjusting your filters"
              : "No promo codes have been created yet"
          }
        />
      )}

      {/* Table */}
      {!loading && !error && codes.length > 0 && (
        <>
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Owner
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Discount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Expires
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {codes.map((code) => (
                  <tr key={code._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-mono text-sm font-medium text-gray-900">
                        {code.code}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getTypeBadge(code.type)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {code.ownerName || code.ownerEmail || code.ownerId}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">
                        {formatDiscount(code)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(code)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {formatExpiry(code.expiresAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        {/* Copy Button */}
                        <button
                          onClick={() => handleCopyCode(code.code)}
                          className="inline-flex items-center gap-1 px-3 py-1 text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded transition-colors"
                          title="Copy code"
                        >
                          {copiedCode === code.code ? (
                            <>
                              <CheckIcon className="w-4 h-4" />
                              Copied
                            </>
                          ) : (
                            <>
                              <ClipboardDocumentIcon className="w-4 h-4" />
                              Copy
                            </>
                          )}
                        </button>

                        {/* Deactivate Button - only show for active, unused codes */}
                        {code.isActive && !code.isUsed && (
                          <button
                            onClick={() =>
                              handleDeactivate(code._id, code.code)
                            }
                            className="inline-flex items-center gap-1 px-3 py-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                            title="Deactivate code"
                          >
                            <XMarkIcon className="w-4 h-4" />
                            Deactivate
                          </button>
                        )}

                        {/* Reactivate Button - only show for inactive, unused codes */}
                        {!code.isActive && !code.isUsed && (
                          <button
                            onClick={() =>
                              handleReactivate(code._id, code.code)
                            }
                            className="inline-flex items-center gap-1 px-3 py-1 text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-colors"
                            title="Reactivate code"
                          >
                            <CheckIcon className="w-4 h-4" />
                            Reactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Deactivate Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeactivateModal}
        onClose={cancelDeactivate}
        onConfirm={confirmDeactivate}
        title="Deactivate Promo Code"
        message={`Are you sure you want to deactivate code "${codeToDeactivate?.code}"? This action cannot be undone.`}
        confirmText="Deactivate"
        type="danger"
        isLoading={isDeactivating}
      />

      {/* Reactivate Confirmation Modal */}
      <ConfirmationModal
        isOpen={showReactivateModal}
        onClose={cancelReactivate}
        onConfirm={confirmReactivate}
        title="Reactivate Promo Code"
        message={`Are you sure you want to reactivate code "${codeToReactivate?.code}"? This will allow the code to be used again.`}
        confirmText="Reactivate"
        type="info"
        isLoading={isReactivating}
      />
    </div>
  );
}

// Tab 2: Create Staff Access Code
function CreateStaffCodeTab() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [createdCode, setCreatedCode] = useState<any>(null);

  // Form fields
  const [userSearch, setUserSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const [programMode, setProgramMode] = useState<"all" | "specific">("all");
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [loadingPrograms, setLoadingPrograms] = useState(false);

  const [expirationMode, setExpirationMode] = useState<"never" | "custom">(
    "never"
  );
  const [expirationDate, setExpirationDate] = useState("");

  const [copiedCode, setCopiedCode] = useState(false);

  // Load programs on mount
  useEffect(() => {
    loadPrograms();
  }, []);

  // Search users with debounce
  useEffect(() => {
    if (userSearch.trim().length < 2) {
      setSearchResults([]);
      setShowUserDropdown(false);
      return;
    }

    const timer = setTimeout(() => {
      searchUsers();
    }, 300);

    return () => clearTimeout(timer);
  }, [userSearch]);

  const loadPrograms = async () => {
    try {
      setLoadingPrograms(true);
      const response = await apiClient.listPrograms();
      setPrograms(response as any[]);
    } catch (err) {
      console.error("Failed to load programs:", err);
    } finally {
      setLoadingPrograms(false);
    }
  };

  const searchUsers = async () => {
    try {
      setSearchingUsers(true);
      const response = await apiClient.searchUsers(userSearch);
      setSearchResults(response.results as any[]);
      setShowUserDropdown(true);
    } catch (err) {
      console.error("Failed to search users:", err);
      setSearchResults([]);
    } finally {
      setSearchingUsers(false);
    }
  };

  const selectUser = (user: any) => {
    setSelectedUser(user);
    setUserSearch(`${user.firstName} ${user.lastName} (${user.email})`);
    setShowUserDropdown(false);
  };

  const clearUserSelection = () => {
    setSelectedUser(null);
    setUserSearch("");
    setSearchResults([]);
  };

  const toggleProgram = (programId: string) => {
    setSelectedPrograms((prev) =>
      prev.includes(programId)
        ? prev.filter((id) => id !== programId)
        : [...prev, programId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedUser) {
      setError("Please select a user");
      return;
    }

    if (programMode === "specific" && selectedPrograms.length === 0) {
      setError("Please select at least one program");
      return;
    }

    if (expirationMode === "custom" && !expirationDate) {
      setError("Please select an expiration date");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const payload: any = {
        userId: selectedUser._id || selectedUser.id,
      };

      if (programMode === "specific") {
        payload.allowedProgramIds = selectedPrograms;
      }

      if (expirationMode === "custom") {
        payload.expiresAt = new Date(expirationDate).toISOString();
      }

      const response = await apiClient.createStaffPromoCode(payload);

      setCreatedCode(response.code);
      setSuccess(true);

      // Reset form
      clearUserSelection();
      setProgramMode("all");
      setSelectedPrograms([]);
      setExpirationMode("never");
      setExpirationDate("");
    } catch (err: any) {
      setError(err.message || "Failed to create staff promo code");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = async () => {
    if (!createdCode) return;

    try {
      await navigator.clipboard.writeText(createdCode.code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {
      console.error("Failed to copy code:", err);
    }
  };

  const closeSuccessModal = () => {
    setSuccess(false);
    setCreatedCode(null);
    setCopiedCode(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          Create Staff Access Code
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Generate a 100% discount code for staff, volunteers, or special guests
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* User Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select User <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  onFocus={() =>
                    userSearch.length >= 2 && setShowUserDropdown(true)
                  }
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  disabled={selectedUser !== null}
                />
                {searchingUsers && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <LoadingSpinner size="sm" />
                  </div>
                )}
              </div>
              {selectedUser && (
                <button
                  type="button"
                  onClick={clearUserSelection}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 border border-red-300 rounded-lg transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            {/* User Dropdown */}
            {showUserDropdown && searchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {searchResults.map((user) => (
                  <button
                    key={user._id || user.id}
                    type="button"
                    onClick={() => selectUser(user)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                  >
                    <div className="font-medium text-gray-900">
                      {user.firstName} {user.lastName}
                    </div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                  </button>
                ))}
              </div>
            )}

            {selectedUser && (
              <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckIcon className="w-5 h-5 text-green-600" />
                  <div>
                    <div className="font-medium text-gray-900">
                      {selectedUser.firstName} {selectedUser.lastName}
                    </div>
                    <div className="text-sm text-gray-600">
                      {selectedUser.email}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Program Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Program Access
          </label>
          <div className="space-y-3">
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={programMode === "all"}
                  onChange={() => setProgramMode("all")}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">All programs</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={programMode === "specific"}
                  onChange={() => setProgramMode("specific")}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Specific programs</span>
              </label>
            </div>

            {programMode === "specific" && (
              <div className="border border-gray-200 rounded-lg p-4 max-h-60 overflow-y-auto">
                {loadingPrograms ? (
                  <div className="flex justify-center py-4">
                    <LoadingSpinner size="sm" />
                  </div>
                ) : programs.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No programs available
                  </p>
                ) : (
                  <div className="space-y-2">
                    {programs.map((program) => (
                      <label
                        key={program._id || program.id}
                        className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedPrograms.includes(
                            program._id || program.id
                          )}
                          onChange={() =>
                            toggleProgram(program._id || program.id)
                          }
                          className="mr-3"
                        />
                        <span className="text-sm text-gray-900">
                          {program.title}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Expiration Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Expiration
          </label>
          <div className="space-y-3">
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={expirationMode === "never"}
                  onChange={() => setExpirationMode("never")}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Never expires</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={expirationMode === "custom"}
                  onChange={() => setExpirationMode("custom")}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Custom date</span>
              </label>
            </div>

            {expirationMode === "custom" && (
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="date"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex gap-3">
          <Button
            type="submit"
            variant="primary"
            disabled={loading}
            className="flex-1"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <LoadingSpinner size="sm" />
                Creating Code...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <PlusIcon className="w-5 h-5" />
                Create Staff Code
              </span>
            )}
          </Button>
        </div>
      </form>

      {/* Success Modal */}
      {success && createdCode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="text-center">
              <div className="text-6xl mb-4">🎉</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Staff Code Created!
              </h3>
              <p className="text-gray-600 mb-6">
                The promo code has been generated successfully.
              </p>

              {/* Code Display */}
              <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-4 mb-6">
                <div className="text-sm text-gray-500 mb-1">Promo Code</div>
                <div className="font-mono text-3xl font-bold text-purple-600 mb-3">
                  {createdCode.code}
                </div>
                <button
                  onClick={handleCopyCode}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  {copiedCode ? (
                    <>
                      <CheckIcon className="w-5 h-5" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <ClipboardDocumentIcon className="w-5 h-5" />
                      Copy Code
                    </>
                  )}
                </button>
              </div>

              {/* Code Details */}
              <div className="text-left bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Owner:</span>
                    <span className="font-medium text-gray-900">
                      {createdCode.ownerName || createdCode.ownerEmail}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Discount:</span>
                    <span className="font-medium text-gray-900">100% off</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Programs:</span>
                    <span className="font-medium text-gray-900">
                      {createdCode.allowedProgramIds?.length
                        ? `${createdCode.allowedProgramIds.length} program(s)`
                        : "All programs"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Expires:</span>
                    <span className="font-medium text-gray-900">
                      {createdCode.expiresAt
                        ? new Date(createdCode.expiresAt).toLocaleDateString()
                        : "Never"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    closeSuccessModal();
                    // Reset form to create another
                  }}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Create Another
                </button>
                <button
                  onClick={closeSuccessModal}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Tab 3: Bundle Discount Configuration
function BundleConfigTab() {
  // State
  const [config, setConfig] = useState<{
    enabled: boolean;
    discountAmount: number;
    expiryDays: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Form state (local edits before save)
  const [formEnabled, setFormEnabled] = useState(false);
  const [formAmount, setFormAmount] = useState(5000); // $50 in cents
  const [formExpiry, setFormExpiry] = useState(30);

  // Load current config on mount
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await apiClient.getBundleDiscountConfig();
      setConfig(data.config);
      setFormEnabled(data.config.enabled);
      setFormAmount(data.config.discountAmount);
      setFormExpiry(data.config.expiryDays);
    } catch (err) {
      console.error("Failed to load bundle config:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load configuration"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");
      setSuccessMessage("");

      await apiClient.updateBundleDiscountConfig({
        enabled: formEnabled,
        discountAmount: formAmount,
        expiryDays: formExpiry,
      });

      setSuccessMessage("Bundle discount configuration saved successfully!");
      // Reload to get fresh data
      await loadConfig();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      console.error("Failed to save bundle config:", err);
      setError(
        err instanceof Error ? err.message : "Failed to save configuration"
      );
    } finally {
      setSaving(false);
    }
  };

  // Format amount for display
  const formatAmount = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Bundle Discount Settings
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Configure automatic promo codes generated after purchases
          </p>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Success Display */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-800">{successMessage}</p>
        </div>
      )}

      {/* Configuration Form */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-900">
              Enable Bundle Codes
            </label>
            <p className="text-sm text-gray-600 mt-1">
              Automatically generate promo codes after each purchase
            </p>
          </div>
          <button
            onClick={() => setFormEnabled(!formEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              formEnabled ? "bg-green-600" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                formEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Discount Amount Slider */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-900">
              Discount Amount
            </label>
            <span className="text-lg font-semibold text-purple-600">
              {formatAmount(formAmount)}
            </span>
          </div>
          <input
            type="range"
            min="1000"
            max="20000"
            step="500"
            value={formAmount}
            onChange={(e) => setFormAmount(Number(e.target.value))}
            disabled={!formEnabled}
            className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${
              formEnabled
                ? "bg-purple-200 accent-purple-600"
                : "bg-gray-200 cursor-not-allowed"
            }`}
          />
          <div className="flex justify-between text-xs text-gray-600 mt-1">
            <span>$10</span>
            <span>$200</span>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Each bundle code will offer {formatAmount(formAmount)} off
          </p>
        </div>

        {/* Expiry Days Dropdown */}
        <div>
          <label className="text-sm font-medium text-gray-900 block mb-2">
            Code Expiration
          </label>
          <select
            value={formExpiry}
            onChange={(e) => setFormExpiry(Number(e.target.value))}
            disabled={!formEnabled}
            className={`w-full px-4 py-2 border border-gray-300 rounded-lg ${
              formEnabled
                ? "bg-white text-gray-900"
                : "bg-gray-100 text-gray-500 cursor-not-allowed"
            }`}
          >
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
          </select>
          <p className="text-sm text-gray-600 mt-2">
            Bundle codes will expire {formExpiry} days after purchase
          </p>
        </div>

        {/* Preview Section */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            📋 Current Configuration Preview
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Status:</span>
              <span
                className={`font-medium ${
                  formEnabled ? "text-green-600" : "text-gray-500"
                }`}
              >
                {formEnabled ? "✅ Enabled" : "❌ Disabled"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Discount Amount:</span>
              <span className="font-medium text-gray-900">
                {formatAmount(formAmount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Valid For:</span>
              <span className="font-medium text-gray-900">
                {formExpiry} days
              </span>
            </div>
            {formEnabled && (
              <div className="mt-3 pt-3 border-t border-purple-300">
                <p className="text-xs text-gray-700 italic">
                  💡 When a user completes a purchase, they will automatically
                  receive a{" "}
                  <strong className="text-purple-700">
                    {formatAmount(formAmount)} promo code
                  </strong>{" "}
                  that expires in <strong>{formExpiry} days</strong>.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saving || !config}
            className="px-6"
          >
            {saving ? "Saving..." : "Save Configuration"}
          </Button>
        </div>
      </div>

      {/* Info Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <div className="text-2xl">ℹ️</div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">
              How Bundle Codes Work
            </h3>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>
                • Bundle codes are automatically generated when users complete a
                purchase
              </li>
              <li>
                • Each code provides a fixed discount amount (set above) off
                their next purchase
              </li>
              <li>
                • Codes can be used on any program and are single-use only
              </li>
              <li>• Users can view their codes on the "My Promo Codes" page</li>
              <li>
                • Codes expire after the configured number of days (set above)
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
