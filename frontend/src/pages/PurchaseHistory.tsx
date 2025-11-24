import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { purchaseService } from "../services/api";
import { formatCurrency } from "../utils/currency";

interface Purchase {
  id: string;
  orderNumber: string;
  purchaseType: "program" | "event"; // Type of purchase
  programId?:
    | {
        id: string; // Backend toJSON converts _id to id
        title: string;
        programType?: string;
      }
    | string; // Can be ObjectId string if not populated
  eventId?:
    | {
        id: string;
        title: string;
      }
    | string; // Event details if purchaseType = 'event'
  fullPrice: number;
  classRepDiscount: number;
  earlyBirdDiscount: number;
  finalPrice: number;
  isClassRep: boolean;
  isEarlyBird: boolean;
  promoCode?: string;
  promoDiscountAmount?: number;
  promoDiscountPercent?: number;
  purchaseDate: string;
  status:
    | "pending"
    | "completed"
    | "failed"
    | "refunded"
    | "refund_processing"
    | "refund_failed";
  refundedAt?: string;
  refundInitiatedAt?: string;
  refundFailureReason?: string;
  stripeRefundId?: string;
  createdAt?: string;
}

interface RefundEligibility {
  isEligible: boolean;
  reason?: string;
  daysRemaining?: number;
  purchaseDate: string;
  refundDeadline: string;
}

export default function PurchaseHistory() {
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [pendingPurchases, setPendingPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState<{
    purchaseId: string;
    programTitle: string;
  } | null>(null);
  const [errorModal, setErrorModal] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const [refundConfirm, setRefundConfirm] = useState<{
    purchase: Purchase;
    eligibility: RefundEligibility;
  } | null>(null);
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [purchaseTypeFilter, setPurchaseTypeFilter] = useState<
    "all" | "program" | "event"
  >("all");

  const loadPurchases = async () => {
    try {
      setLoading(true);
      setError(null);
      const [completedData, pendingData] = await Promise.all([
        purchaseService.getMyPurchases(),
        purchaseService.getMyPendingPurchases(),
      ]);
      setPurchases(completedData as Purchase[]);
      setPendingPurchases(pendingData as Purchase[]);
    } catch (err) {
      console.error("Error loading purchases:", err);
      setError("Failed to load purchase history. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPurchases();
  }, []);

  // Filter purchases by type
  const filteredPurchases = purchases.filter((p) => {
    if (purchaseTypeFilter === "all") return true;
    return p.purchaseType === purchaseTypeFilter;
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openDropdownId) {
        const target = event.target as HTMLElement;
        const dropdown = document.getElementById(`dropdown-${openDropdownId}`);
        const button = document.getElementById(`actions-btn-${openDropdownId}`);

        // Don't close if clicking inside the dropdown or on the button
        if (dropdown?.contains(target) || button?.contains(target)) {
          return;
        }

        setOpenDropdownId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openDropdownId]);

  const handleRetryPurchase = async (purchaseId: string) => {
    try {
      setRetryingId(purchaseId);
      const { sessionUrl } = await purchaseService.retryPurchase(purchaseId);
      // Redirect to Stripe checkout
      window.location.href = sessionUrl;
    } catch (err: unknown) {
      console.error("Error retrying purchase:", err);
      const errorMessage =
        err && typeof err === "object" && "message" in err
          ? String(err.message)
          : "Failed to retry purchase. Please try again.";
      setErrorModal({
        title: "Retry Failed",
        message: errorMessage,
      });
      setRetryingId(null);
    }
  };

  const handleCancelPurchase = async (purchaseId: string) => {
    try {
      setCancelingId(purchaseId);
      await purchaseService.cancelPendingPurchase(purchaseId);
      // Reload purchases to refresh the list
      await loadPurchases();
      setCancelConfirm(null);
    } catch (err) {
      console.error("Error canceling purchase:", err);
      setErrorModal({
        title: "Cancellation Failed",
        message: "Failed to cancel purchase. Please try again.",
      });
      setCancelConfirm(null);
    } finally {
      setCancelingId(null);
    }
  };

  const handleRequestRefund = async (purchase: Purchase) => {
    try {
      // Check eligibility first
      const eligibility = await purchaseService.checkRefundEligibility(
        purchase.id
      );

      if (!eligibility.isEligible) {
        setErrorModal({
          title: "Refund Not Available",
          message:
            eligibility.reason || "This purchase is not eligible for a refund.",
        });
        return;
      }

      // Show confirmation modal
      setRefundConfirm({ purchase, eligibility });
    } catch (err) {
      console.error("Error checking refund eligibility:", err);
      setErrorModal({
        title: "Error",
        message: "Failed to check refund eligibility. Please try again.",
      });
    }
  };

  const handleConfirmRefund = async () => {
    if (!refundConfirm) return;

    try {
      setRefundingId(refundConfirm.purchase.id);
      await purchaseService.initiateRefund(refundConfirm.purchase.id);

      // Reload purchases to show updated status
      await loadPurchases();
      setRefundConfirm(null);

      // Show success message
      setErrorModal({
        title: "Refund Initiated",
        message:
          "Your refund request has been submitted. You'll receive a confirmation email shortly, and the refund should appear in your account within 5-10 business days.",
      });
    } catch (err) {
      console.error("Error initiating refund:", err);
      const errorMessage =
        err && typeof err === "object" && "message" in err
          ? String(err.message)
          : "Failed to initiate refund. Please try again or contact support.";
      setErrorModal({
        title: "Refund Failed",
        message: errorMessage,
      });
      setRefundConfirm(null);
    } finally {
      setRefundingId(null);
    }
  };

  const getStatusBadge = (status: Purchase["status"]) => {
    const badges = {
      completed: "bg-green-100 text-green-800",
      pending: "bg-yellow-100 text-yellow-800",
      failed: "bg-red-100 text-red-800",
      refunded: "bg-blue-100 text-blue-800",
      refund_processing: "bg-purple-100 text-purple-800",
      refund_failed: "bg-red-100 text-red-800",
    };

    const labels = {
      completed: "Completed",
      pending: "Pending",
      failed: "Failed",
      refunded: "Refunded",
      refund_processing: "Refund Processing",
      refund_failed: "Refund Failed",
    };

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badges[status]}`}
      >
        {labels[status]}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            Purchase History
          </h1>
          <div className="flex justify-center items-center min-h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            Purchase History
          </h1>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Purchase History</h1>
          <p className="mt-2 text-gray-600">
            View all your program enrollments and receipts
          </p>
        </div>

        {/* Pending Purchases Section */}
        {pendingPurchases.length > 0 && (
          <div className="mb-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                Pending Purchases
              </h2>
              <span className="text-sm text-gray-500">
                {pendingPurchases.length} pending checkout
                {pendingPurchases.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> These purchases have not been completed.
                You can try again to complete the checkout or cancel them to
                start fresh.
              </p>
            </div>
            <div className="space-y-4">
              {pendingPurchases.map((purchase) => (
                <div
                  key={purchase.id}
                  className="bg-white border-2 border-yellow-300 rounded-lg p-6 shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {purchase.purchaseType === "event"
                            ? typeof purchase.eventId === "object"
                              ? purchase.eventId.title
                              : "Event"
                            : typeof purchase.programId === "object"
                            ? purchase.programId.title
                            : "Program"}
                        </h3>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          Pending
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mb-1">
                        Order #{purchase.orderNumber}
                      </p>
                      <p className="text-sm text-gray-500">
                        Created:{" "}
                        {new Date(
                          purchase.createdAt || purchase.purchaseDate
                        ).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      <div className="mt-3">
                        <p className="text-lg font-bold text-gray-900">
                          {formatCurrency(purchase.finalPrice || 0)}
                        </p>
                        {(purchase.classRepDiscount > 0 ||
                          purchase.earlyBirdDiscount > 0 ||
                          purchase.promoDiscountAmount ||
                          purchase.promoDiscountPercent) && (
                          <p className="text-sm text-gray-500">
                            <span className="line-through">
                              {formatCurrency(purchase.fullPrice || 0)}
                            </span>
                            <span className="ml-2 text-green-600">
                              Save{" "}
                              {formatCurrency(
                                (purchase.classRepDiscount || 0) +
                                  (purchase.earlyBirdDiscount || 0) +
                                  (purchase.promoDiscountAmount ||
                                    (purchase.promoDiscountPercent
                                      ? Math.round(
                                          ((purchase.fullPrice -
                                            (purchase.classRepDiscount || 0) -
                                            (purchase.earlyBirdDiscount || 0)) *
                                            purchase.promoDiscountPercent) /
                                            100
                                        )
                                      : 0))
                              )}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 ml-4">
                      <button
                        onClick={() => handleRetryPurchase(purchase.id)}
                        disabled={retryingId === purchase.id}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                      >
                        {retryingId === purchase.id
                          ? "Redirecting..."
                          : "Try Again"}
                      </button>
                      <button
                        onClick={() =>
                          setCancelConfirm({
                            purchaseId: purchase.id,
                            programTitle:
                              purchase.purchaseType === "event"
                                ? typeof purchase.eventId === "object"
                                  ? purchase.eventId.title
                                  : "Event"
                                : typeof purchase.programId === "object"
                                ? purchase.programId.title
                                : "Program",
                          })
                        }
                        disabled={cancelingId === purchase.id}
                        className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                      >
                        {cancelingId === purchase.id
                          ? "Canceling..."
                          : "Cancel"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completed Purchases Title */}
        {purchases.length > 0 && pendingPurchases.length > 0 && (
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Completed Purchases
            </h2>
          </div>
        )}

        {/* Empty State */}
        {purchases.length === 0 && pendingPurchases.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              No purchases yet
            </h3>
            <p className="mt-2 text-gray-600">
              Your program enrollments will appear here.
            </p>
            <button
              onClick={() => navigate("/dashboard/programs")}
              className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700"
            >
              Browse Programs
            </button>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow-sm p-6">
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
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">
                      Total Enrollments
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {purchases.filter((p) => p.status === "completed").length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
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
                      Total Spent
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(
                        purchases
                          .filter((p) => p.status === "completed")
                          .reduce((sum, p) => sum + (p.finalPrice || 0), 0)
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
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
                        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                      />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">
                      Total Savings
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(
                        purchases
                          .filter((p) => p.status === "completed")
                          .reduce(
                            (sum, p) =>
                              sum +
                              (p.classRepDiscount || 0) +
                              (p.earlyBirdDiscount || 0) +
                              (p.promoDiscountAmount ||
                                (p.promoDiscountPercent
                                  ? Math.round(
                                      ((p.fullPrice -
                                        (p.classRepDiscount || 0) -
                                        (p.earlyBirdDiscount || 0)) *
                                        p.promoDiscountPercent) /
                                        100
                                    )
                                  : 0)),
                            0
                          )
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Filter Controls */}
            <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-gray-700">
                  Filter by Type:
                </label>
                <select
                  value={purchaseTypeFilter}
                  onChange={(e) =>
                    setPurchaseTypeFilter(
                      e.target.value as "all" | "program" | "event"
                    )
                  }
                  className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">All Purchases</option>
                  <option value="program">Programs Only</option>
                  <option value="event">Events Only</option>
                </select>
                <span className="text-sm text-gray-500">
                  Showing {filteredPurchases.length} of {purchases.length}{" "}
                  purchases
                </span>
              </div>
            </div>

            {/* Purchase Table */}
            <div
              className="bg-white rounded-lg shadow-sm"
              style={{ overflow: "visible" }}
            >
              <div
                className="relative"
                style={{ overflowX: "auto", overflowY: "visible" }}
              >
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Purchase Date
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Order #
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
                        Program / Event
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Price
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Status
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredPurchases.map((purchase) => (
                      <tr
                        key={purchase.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {new Date(purchase.purchaseDate).toLocaleDateString(
                            "en-US",
                            {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            }
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {purchase.orderNumber}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              purchase.purchaseType === "program"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {purchase.purchaseType === "program"
                              ? "Program"
                              : "Event"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {purchase.purchaseType === "program" ? (
                            <>
                              <button
                                onClick={() => {
                                  // Extract program ID - handle both object and string formats
                                  const programId =
                                    typeof purchase.programId === "object"
                                      ? purchase.programId?.id
                                      : purchase.programId;
                                  if (programId) {
                                    navigate(
                                      `/dashboard/programs/${programId}`
                                    );
                                  }
                                }}
                                className="text-sm font-medium text-purple-600 hover:text-purple-800 hover:underline text-left"
                              >
                                {typeof purchase.programId === "object"
                                  ? purchase.programId?.title
                                  : "Program"}
                              </button>
                              {typeof purchase.programId === "object" &&
                                purchase.programId?.programType && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    {purchase.programId.programType}
                                  </p>
                                )}
                            </>
                          ) : (
                            <button
                              onClick={() => {
                                const eventId =
                                  typeof purchase.eventId === "object"
                                    ? purchase.eventId?.id
                                    : purchase.eventId;
                                if (eventId) {
                                  navigate(`/dashboard/event/${eventId}`);
                                }
                              }}
                              className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline text-left"
                            >
                              {typeof purchase.eventId === "object"
                                ? purchase.eventId?.title
                                : "Event"}
                            </button>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm">
                            <div className="font-medium text-gray-900">
                              {formatCurrency(purchase.finalPrice || 0)}
                            </div>
                            {(purchase.classRepDiscount > 0 ||
                              purchase.earlyBirdDiscount > 0 ||
                              purchase.promoDiscountAmount ||
                              purchase.promoDiscountPercent) && (
                              <div className="text-xs text-gray-500">
                                <span className="line-through">
                                  {formatCurrency(purchase.fullPrice || 0)}
                                </span>
                                <span className="ml-1 text-green-600 font-medium">
                                  (
                                  {formatCurrency(
                                    (purchase.classRepDiscount || 0) +
                                      (purchase.earlyBirdDiscount || 0) +
                                      (purchase.promoDiscountAmount ||
                                        (purchase.promoDiscountPercent
                                          ? Math.round(
                                              ((purchase.fullPrice -
                                                (purchase.classRepDiscount ||
                                                  0) -
                                                (purchase.earlyBirdDiscount ||
                                                  0)) *
                                                purchase.promoDiscountPercent) /
                                                100
                                            )
                                          : 0))
                                  )}{" "}
                                  off)
                                </span>
                              </div>
                            )}
                            {purchase.isClassRep && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mt-1">
                                Class Rep
                              </span>
                            )}
                            {purchase.isEarlyBird && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 mt-1 ml-1">
                                Early Bird
                              </span>
                            )}
                            {purchase.promoCode && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 mt-1 ml-1">
                                {purchase.promoDiscountPercent === 100
                                  ? "Staff 100%"
                                  : `Promo: ${purchase.promoCode}`}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(purchase.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="relative inline-block text-left">
                            <button
                              id={`actions-btn-${purchase.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenDropdownId(
                                  openDropdownId === purchase.id
                                    ? null
                                    : purchase.id
                                );
                              }}
                              className="text-purple-600 hover:text-purple-900 font-medium inline-flex items-center gap-1"
                            >
                              Actions
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 9l-7 7-7-7"
                                />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Cancel Confirmation Modal */}
        {cancelConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Cancel Pending Purchase
              </h3>
              <p className="text-gray-700 mb-4">
                Are you sure you want to cancel your pending purchase for "
                <strong>{cancelConfirm.programTitle}</strong>"?
              </p>
              <p className="text-sm text-gray-600 mb-6">
                This action cannot be undone. You can always start a new
                checkout later if you change your mind.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setCancelConfirm(null)}
                  disabled={cancelingId === cancelConfirm.purchaseId}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Keep Purchase
                </button>
                <button
                  onClick={() => handleCancelPurchase(cancelConfirm.purchaseId)}
                  disabled={cancelingId === cancelConfirm.purchaseId}
                  className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {cancelingId === cancelConfirm.purchaseId
                    ? "Canceling..."
                    : "Cancel Purchase"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Refund Confirmation Modal */}
        {refundConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-lg w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Request Refund
              </h3>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-start">
                  <svg
                    className="h-5 w-5 text-blue-600 mt-0.5 mr-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900">
                      Refund Eligibility
                    </p>
                    <p className="text-sm text-blue-800 mt-1">
                      This purchase is eligible for a full refund. You have{" "}
                      <strong>
                        {refundConfirm.eligibility.daysRemaining} days
                      </strong>{" "}
                      remaining.
                    </p>
                    <p className="text-xs text-blue-700 mt-1">
                      Refund deadline:{" "}
                      {new Date(
                        refundConfirm.eligibility.refundDeadline
                      ).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Order Number:</span>
                  <span className="font-medium text-gray-900">
                    {refundConfirm.purchase.orderNumber}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Program:</span>
                  <span className="font-medium text-gray-900">
                    {typeof refundConfirm.purchase.programId === "object"
                      ? refundConfirm.purchase.programId.title
                      : "Program"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Refund Amount:</span>
                  <span className="font-medium text-gray-900">
                    {formatCurrency(refundConfirm.purchase.finalPrice || 0)}
                  </span>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-yellow-900">
                  <strong>Please Note:</strong> The refund will be processed
                  within 5-10 business days and will be credited to your
                  original payment method. You'll lose access to the program
                  immediately upon confirmation.
                </p>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setRefundConfirm(null)}
                  disabled={refundingId === refundConfirm.purchase.id}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmRefund}
                  disabled={refundingId === refundConfirm.purchase.id}
                  className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {refundingId === refundConfirm.purchase.id
                    ? "Processing..."
                    : "Confirm Refund"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dropdown Menus - Rendered outside table to avoid clipping */}
        {openDropdownId &&
          purchases.map((purchase) => {
            if (purchase.id !== openDropdownId) return null;

            const buttonEl = document.getElementById(
              `actions-btn-${purchase.id}`
            );
            if (!buttonEl) return null;

            const rect = buttonEl.getBoundingClientRect();

            return (
              <div
                key={`dropdown-${purchase.id}`}
                id={`dropdown-${purchase.id}`}
                className="fixed w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50"
                style={{
                  top: `${rect.bottom + 8}px`,
                  left: `${rect.right - 192}px`, // 192px = w-48
                }}
              >
                <div className="py-1">
                  <button
                    onClick={() => {
                      navigate(`/dashboard/purchase-receipt/${purchase.id}`);
                      setOpenDropdownId(null);
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    View Receipt
                  </button>

                  {purchase.status === "completed" && (
                    <button
                      onClick={() => {
                        handleRequestRefund(purchase);
                        setOpenDropdownId(null);
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Request Refund
                    </button>
                  )}

                  {purchase.status === "refund_failed" && (
                    <button
                      onClick={() => {
                        handleRequestRefund(purchase);
                        setOpenDropdownId(null);
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Retry Refund
                    </button>
                  )}
                </div>
              </div>
            );
          })}

        {/* Error Modal */}
        {errorModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-red-600 mb-4">
                {errorModal.title}
              </h3>
              <p className="text-gray-700 mb-6">{errorModal.message}</p>
              <div className="flex justify-end">
                <button
                  onClick={() => setErrorModal(null)}
                  className="px-4 py-2 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
