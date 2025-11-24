import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import LoadingSpinner from "../../common/LoadingSpinner";
import PurchaseTable from "../../purchases/PurchaseTable";
import type { PurchaseTableRow } from "../../purchases/PurchaseTable";
import Pagination from "../../common/Pagination";
import { formatCurrency } from "../../../utils/currency";
import { adminPurchaseService } from "../../../services/api";

interface PaymentStats {
  totalRevenue: number;
  totalPurchases: number;
  pendingPurchases: number;
  pendingRevenue: number;
  failedPurchases: number;
  failedRevenue: number;
  refundedPurchases: number;
  refundedRevenue: number;
  uniqueBuyers: number;
  classRepPurchases: number;
  promoCodeUsage: number;
  last30Days: {
    purchases: number;
    revenue: number;
    refunds: number;
    refundedRevenue: number;
  };
}

export default function ProgramPurchasesTab() {
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState<PurchaseTableRow[]>([]);
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [purchaseTypeFilter, setPurchaseTypeFilter] = useState<
    "all" | "program" | "event"
  >("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const ITEMS_PER_PAGE = 20;

  const loadStats = async () => {
    try {
      const response = await adminPurchaseService.getPaymentStats();
      setStats(response.stats);
    } catch (err) {
      console.error("Error loading payment stats:", err);
      // Don't set error state - stats are optional
    }
  };

  const loadPurchases = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await adminPurchaseService.getAllPurchases({
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        search: searchQuery,
        status: statusFilter,
      });

      setPurchases(response.purchases as PurchaseTableRow[]);
      setTotalPages(response.pagination.totalPages);
      setTotal(response.pagination.total);
    } catch (err) {
      console.error("Error loading purchases:", err);
      setError("Failed to load income history. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
    loadPurchases();
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

  const handleRowClick = (purchase: PurchaseTableRow) => {
    // Navigate to purchase receipt if available
    if (purchase.id) {
      navigate(`/dashboard/purchases/${purchase.id}/receipt`);
    }
  };

  if (loading && !purchases.length) {
    return <LoadingSpinner size="lg" />;
  }

  if (error && !purchases.length) {
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
                <p className="text-sm font-medium text-gray-600">Net Revenue</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(stats.totalRevenue)}
                </p>
                {stats.refundedRevenue > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    {formatCurrency(stats.refundedRevenue)} refunded
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Total Purchases */}
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
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.totalPurchases}
                </p>
              </div>
            </div>
          </div>

          {/* Unique Buyers */}
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
                  Unique Buyers
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.uniqueBuyers}
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
                  {stats.last30Days.purchases} purchases
                  {stats.last30Days.refunds > 0 &&
                    ` · ${stats.last30Days.refunds} refunds`}
                </p>
              </div>
            </div>
          </div>

          {/* Pending/Failed (if any) */}
          {(stats.pendingPurchases > 0 || stats.failedPurchases > 0) && (
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
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">
                    Pending/Failed
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(stats.pendingRevenue + stats.failedRevenue)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {stats.pendingPurchases + stats.failedPurchases} purchases
                  </p>
                  <p className="text-xs text-yellow-600 mt-1">⏳ Processing</p>
                </div>
              </div>
            </div>
          )}

          {/* Refunded Revenue (if any) */}
          {stats.refundedPurchases > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-red-100 rounded-lg p-3">
                  <svg
                    className="h-6 w-6 text-red-600"
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
                  <p className="text-sm font-medium text-gray-600">Refunded</p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(stats.refundedRevenue)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {stats.refundedPurchases} purchases
                  </p>
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
              Search purchases
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
                placeholder="Search by user name, email, program, or order number..."
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
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
              <option value="refund_processing">Refund Processing</option>
              <option value="refund_failed">Refund Failed</option>
            </select>
          </div>

          {/* Type Filter */}
          <div className="sm:w-48">
            <label htmlFor="type" className="sr-only">
              Filter by type
            </label>
            <select
              id="type"
              value={purchaseTypeFilter}
              onChange={(e) => {
                setPurchaseTypeFilter(
                  e.target.value as "all" | "program" | "event"
                );
                setCurrentPage(1);
              }}
              className="block w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              <option value="program">Programs Only</option>
              <option value="event">Events Only</option>
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
          Showing {purchases.length} of {total} results
        </div>
      </div>

      {/* Purchase Table */}
      <PurchaseTable
        purchases={purchases}
        showUser={true}
        onRowClick={handleRowClick}
        purchaseTypeFilter={purchaseTypeFilter}
        onPurchaseTypeFilterChange={setPurchaseTypeFilter}
      />

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
