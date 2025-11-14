import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { formatCurrency } from "../utils/currency";
import { adminPurchaseService, donationsService } from "../services/api";
import ProgramPurchasesTab from "../components/admin/income/ProgramPurchasesTab";
import DonationsTab from "../components/admin/income/DonationsTab";

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

type TabType = "purchases" | "donations";

export default function IncomeHistory() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("purchases");
  const [purchaseStats, setPurchaseStats] = useState<PaymentStats | null>(null);
  const [donationStats, setDonationStats] = useState<DonationStats | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  // Check access: Only Super Admin and Administrator
  useEffect(() => {
    if (
      currentUser &&
      currentUser.role !== "Super Admin" &&
      currentUser.role !== "Administrator"
    ) {
      navigate("/dashboard");
    }
  }, [currentUser, navigate]);

  useEffect(() => {
    const loadAllStats = async () => {
      try {
        setLoading(true);

        const [purchaseResponse, donationResponse] = await Promise.all([
          adminPurchaseService.getPaymentStats(),
          donationsService.getAdminDonationStats(),
        ]);

        setPurchaseStats(purchaseResponse.stats);
        setDonationStats(donationResponse);
      } catch (err) {
        console.error("Error loading stats:", err);
        // Don't set error state - stats are optional
      } finally {
        setLoading(false);
      }
    };

    if (
      currentUser &&
      (currentUser.role === "Super Admin" ||
        currentUser.role === "Administrator")
    ) {
      loadAllStats();
    }
  }, [currentUser]);

  // Calculate combined totals
  const combinedTotalRevenue =
    (purchaseStats?.totalRevenue || 0) + (donationStats?.totalRevenue || 0);
  const combinedLast30DaysRevenue =
    (purchaseStats?.last30Days.revenue || 0) +
    (donationStats?.last30Days.revenue || 0);
  const combinedUniquePeople =
    (purchaseStats?.uniqueBuyers || 0) + (donationStats?.uniqueDonors || 0);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Income History</h1>
          <p className="mt-2 text-gray-600">
            View and manage all program purchases and donations across the
            platform
          </p>
        </div>

        {/* Combined Stats Cards */}
        {!loading && (purchaseStats || donationStats) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Total Revenue (Combined) */}
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg shadow-md p-6 border-2 border-green-200">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-green-600 rounded-lg p-3">
                  <svg
                    className="h-6 w-6 text-white"
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
                  <p className="text-sm font-medium text-green-800">
                    Total Revenue
                  </p>
                  <p className="text-2xl font-bold text-green-900">
                    {formatCurrency(combinedTotalRevenue)}
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    Programs + Donations
                  </p>
                </div>
              </div>
            </div>

            {/* Last 30 Days (Combined) */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow-md p-6 border-2 border-blue-200">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-blue-600 rounded-lg p-3">
                  <svg
                    className="h-6 w-6 text-white"
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
                  <p className="text-sm font-medium text-blue-800">
                    Last 30 Days
                  </p>
                  <p className="text-2xl font-bold text-blue-900">
                    {formatCurrency(combinedLast30DaysRevenue)}
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    {purchaseStats?.last30Days.purchases || 0} purchases ·{" "}
                    {donationStats?.last30Days.donations || 0} donations
                  </p>
                </div>
              </div>
            </div>

            {/* Unique People (Combined) */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg shadow-md p-6 border-2 border-purple-200">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-purple-600 rounded-lg p-3">
                  <svg
                    className="h-6 w-6 text-white"
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
                  <p className="text-sm font-medium text-purple-800">
                    Unique People
                  </p>
                  <p className="text-2xl font-bold text-purple-900">
                    {combinedUniquePeople}
                  </p>
                  <p className="text-xs text-purple-700 mt-1">
                    Buyers + Donors
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabbed Interface */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="bg-gray-50 p-1">
            <nav className="flex gap-1">
              <button
                onClick={() => setActiveTab("purchases")}
                className={`px-6 py-3 text-base font-medium rounded-md transition-all duration-200 focus:outline-none focus:ring-0 border-0 ${
                  activeTab === "purchases"
                    ? "bg-white text-purple-600 shadow-md transform translate-y-0"
                    : "bg-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100/50 shadow-none transform translate-y-0.5"
                }`}
              >
                Program Purchases
              </button>
              <button
                onClick={() => setActiveTab("donations")}
                className={`px-6 py-3 text-base font-medium rounded-md transition-all duration-200 focus:outline-none focus:ring-0 border-0 ${
                  activeTab === "donations"
                    ? "bg-white text-purple-600 shadow-md transform translate-y-0"
                    : "bg-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100/50 shadow-none transform translate-y-0.5"
                }`}
              >
                Donations
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === "purchases" && <ProgramPurchasesTab />}
            {activeTab === "donations" && <DonationsTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
