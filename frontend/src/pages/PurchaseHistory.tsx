import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { purchaseService } from "../services/api";
import { formatCurrency } from "../utils/currency";

interface Purchase {
  id: string;
  orderNumber: string;
  programId: {
    _id: string;
    title: string;
    programType?: string;
  };
  fullPrice: number;
  classRepDiscount: number;
  earlyBirdDiscount: number;
  finalPrice: number;
  isClassRep: boolean;
  isEarlyBird: boolean;
  purchaseDate: string;
  status: "pending" | "completed" | "failed" | "refunded";
  createdAt?: string;
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
                          {purchase.programId.title}
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
                          purchase.earlyBirdDiscount > 0) && (
                          <p className="text-sm text-gray-500">
                            <span className="line-through">
                              {formatCurrency(purchase.fullPrice || 0)}
                            </span>
                            <span className="ml-2 text-green-600">
                              Save{" "}
                              {formatCurrency(
                                (purchase.classRepDiscount || 0) +
                                  (purchase.earlyBirdDiscount || 0)
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
                            programTitle: purchase.programId.title,
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
                      {purchases.length}
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
                        purchases.reduce(
                          (sum, p) => sum + (p.finalPrice || 0),
                          0
                        )
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
                        purchases.reduce(
                          (sum, p) =>
                            sum +
                            (p.classRepDiscount || 0) +
                            (p.earlyBirdDiscount || 0),
                          0
                        )
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Purchase Table */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
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
                        Program
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
                    {purchases.map((purchase) => (
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
                        <td className="px-6 py-4">
                          <button
                            onClick={() =>
                              navigate(
                                `/dashboard/programs/${purchase.programId._id}`
                              )
                            }
                            className="text-sm font-medium text-purple-600 hover:text-purple-800 hover:underline text-left"
                          >
                            {purchase.programId.title}
                          </button>
                          <p className="text-xs text-gray-500 mt-1">
                            {purchase.programId.programType}
                          </p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm">
                            <div className="font-medium text-gray-900">
                              {formatCurrency(purchase.finalPrice || 0)}
                            </div>
                            {(purchase.classRepDiscount > 0 ||
                              purchase.earlyBirdDiscount > 0) && (
                              <div className="text-xs text-gray-500">
                                <span className="line-through">
                                  {formatCurrency(purchase.fullPrice || 0)}
                                </span>
                                <span className="ml-1 text-green-600 font-medium">
                                  (
                                  {formatCurrency(
                                    (purchase.classRepDiscount || 0) +
                                      (purchase.earlyBirdDiscount || 0)
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
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              purchase.status === "completed"
                                ? "bg-green-100 text-green-800"
                                : purchase.status === "pending"
                                ? "bg-yellow-100 text-yellow-800"
                                : purchase.status === "failed"
                                ? "bg-red-100 text-red-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {purchase.status.charAt(0).toUpperCase() +
                              purchase.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() =>
                              navigate(
                                `/dashboard/purchase-receipt/${purchase.id}`
                              )
                            }
                            className="text-purple-600 hover:text-purple-900 font-medium"
                          >
                            View Receipt
                          </button>
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
