import { useEffect, useState } from "react";
import { donationsService } from "../../../services/api";
import { formatCurrency } from "../../../utils/currency";
import { formatDateToAmerican } from "../../../utils/eventStatsUtils";
import Pagination from "../../common/Pagination";
import LoadingSpinner from "../../common/LoadingSpinner";

interface DonationRow {
  _id: string;
  giftDate: string;
  user: {
    firstName: string;
    lastName: string;
    email: string;
  };
  type: "one-time" | "recurring";
  status: string;
  amount: number; // in cents
}

interface DonationStats {
  totalRevenue: number;
  totalDonations: number;
  uniqueDonors: number;
  activeRecurringRevenue: number;
  last30Days: {
    donations: number;
    revenue: number;
  };
}

export default function DonationsTab() {
  const [donations, setDonations] = useState<DonationRow[]>([]);
  const [stats, setStats] = useState<DonationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const ITEMS_PER_PAGE = 20;

  const loadStats = async () => {
    try {
      const response = await donationsService.getAdminDonationStats();
      setStats(response);
    } catch (err) {
      console.error("Error loading donation stats:", err);
      // Don't set error state - stats are optional
    }
  };

  const loadDonations = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await donationsService.getAllDonationsAdmin({
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        search: searchQuery,
        status: statusFilter,
      });

      setDonations(response.donations);
      setTotalPages(response.pagination.totalPages);
      setTotal(response.pagination.total);
    } catch (err) {
      console.error("Error loading donations:", err);
      setError("Failed to load donation history. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
    loadDonations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, searchQuery, statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1); // Reset to first page on new search
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const formatType = (type: "one-time" | "recurring") => {
    return type === "one-time" ? "One-Time" : "Recurring";
  };

  const formatStatus = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: "Pending",
      scheduled: "Scheduled",
      active: "Active",
      on_hold: "On Hold",
      completed: "Completed",
      cancelled: "Cancelled",
      failed: "Failed",
    };
    return statusMap[status] || status;
  };

  // Get status color - matches Donate page (GivingTab/ScheduledTab)
  const getStatusColor = (status: string): string => {
    const colorMap: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      scheduled: "bg-blue-100 text-blue-800",
      active: "bg-green-100 text-green-800",
      on_hold: "bg-yellow-100 text-yellow-800", // matches pending/on-hold from ScheduledTab
      completed: "bg-green-100 text-green-800", // matches completed from GivingTab
      cancelled: "bg-gray-100 text-gray-800",
      failed: "bg-red-100 text-red-800",
    };
    return colorMap[status] || "bg-gray-100 text-gray-800";
  };

  if (loading && !donations.length) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <LoadingSpinner size="lg" inline />
      </div>
    );
  }

  if (error && !donations.length) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Revenue */}
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-100 rounded-lg p-3">
                <svg
                  className="h-6 w-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  Total Revenue
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(stats.totalRevenue)}
                </p>
              </div>
            </div>
          </div>

          {/* Total Donations */}
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-100 rounded-lg p-3">
                <svg
                  className="h-6 w-6 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Gifts</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.totalDonations}
                </p>
              </div>
            </div>
          </div>

          {/* Unique Donors */}
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-purple-100 rounded-lg p-3">
                <svg
                  className="h-6 w-6 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  Unique Donors
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.uniqueDonors}
                </p>
              </div>
            </div>
          </div>

          {/* Last 30 Days */}
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-yellow-100 rounded-lg p-3">
                <svg
                  className="h-6 w-6 text-yellow-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">
                  Last 30 Days
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(stats.last30Days.revenue)}
                </p>
                <p className="text-xs text-gray-500">
                  {stats.last30Days.donations} gifts
                </p>
              </div>
            </div>
          </div>

          {/* Active Recurring (if any) */}
          {stats.activeRecurringRevenue > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-purple-100 rounded-lg p-3">
                  <svg
                    className="h-6 w-6 text-purple-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">
                    Active Recurring
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(stats.activeRecurringRevenue)}
                  </p>
                  <p className="text-sm text-purple-600 mt-1">Monthly</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <form
          onSubmit={handleSearch}
          className="flex flex-col sm:flex-row gap-4"
        >
          {/* Search Input */}
          <div className="flex-1">
            <label htmlFor="search" className="sr-only">
              Search donations
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg
                  className="h-5 w-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <input
                id="search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by user name or email..."
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="sm:w-48">
            <label htmlFor="status" className="sr-only">
              Filter by status
            </label>
            <select
              id="status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="block w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="scheduled">Scheduled</option>
              <option value="on_hold">On Hold</option>
              <option value="cancelled">Cancelled</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          {/* Search Button */}
          <button
            type="submit"
            className="sm:w-auto px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors"
          >
            Search
          </button>
        </form>

        {/* Results Count */}
        <div className="mt-4 text-sm text-gray-600">
          Showing {donations.length} of {total} results
        </div>
      </div>

      {/* Donations Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Gift Date
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  User
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Type
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {donations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <p className="text-gray-500">No donations found</p>
                  </td>
                </tr>
              ) : (
                donations.map((donation) => (
                  <tr key={donation._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDateToAmerican(donation.giftDate)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="text-gray-900 font-medium">
                        {donation.user.firstName} {donation.user.lastName}
                      </div>
                      <div className="text-gray-500">{donation.user.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatType(donation.type)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                          donation.status
                        )}`}
                      >
                        {formatStatus(donation.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatCurrency(donation.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            hasNext={currentPage < totalPages}
            hasPrev={currentPage > 1}
            onPageChange={handlePageChange}
            showPageNumbers={true}
            size="md"
            layout="center"
          />
        </div>
      )}
    </div>
  );
}
