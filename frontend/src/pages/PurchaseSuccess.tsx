import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { purchaseService } from "../services/api";
import { formatCurrency } from "../utils/currency";
import BundlePromoCodeCard from "../components/promo/BundlePromoCodeCard";

interface Purchase {
  id: string;
  orderNumber: string;
  programId:
    | {
        id: string; // Backend toJSON converts _id to id
        title: string;
        programType?: string;
      }
    | string; // Can be ObjectId string if not populated
  fullPrice: number;
  classRepDiscount: number;
  earlyBirdDiscount: number;
  finalPrice: number;
  isClassRep: boolean;
  isEarlyBird: boolean;
  purchaseDate: string;
  status: string;
  bundlePromoCode?: string; // Bundle code received after purchase
  bundleDiscountAmount?: number; // Amount of discount in cents (e.g., 5000 = $50)
  bundleExpiresAt?: string; // Expiry date
}

export default function PurchaseSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sessionId = searchParams.get("session_id");

    if (!sessionId) {
      alert("Invalid payment session");
      navigate("/dashboard/programs");
      return;
    }

    const loadPurchase = async (retryCount = 0) => {
      try {
        setLoading(true);
        setError(null);

        // Use the new verify-session endpoint to get purchase by session ID
        const purchaseData = await purchaseService.verifySession(sessionId);
        const typedPurchase = purchaseData as Purchase;
        setPurchase(typedPurchase);
      } catch (error) {
        console.error("Error loading purchase:", error);

        // Retry up to 3 times with increasing delays (webhook might still be processing)
        if (retryCount < 3) {
          const delay = (retryCount + 1) * 2000; // 2s, 4s, 6s
          console.log(
            `Retrying in ${delay}ms... (attempt ${retryCount + 1}/3)`
          );
          setTimeout(() => loadPurchase(retryCount + 1), delay);
        } else {
          setError(
            "Your payment was successful, but we're still processing your purchase. Please check your purchase history in a moment."
          );
        }
      } finally {
        setLoading(false);
      }
    };

    loadPurchase();
  }, [searchParams, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your purchase...</p>
        </div>
      </div>
    );
  }

  // Show error state if purchase couldn't be loaded after retries
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-center mb-6">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-yellow-100">
                <svg
                  className="h-10 w-10 text-yellow-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h1 className="mt-4 text-2xl font-bold text-gray-900">
                Payment Processing
              </h1>
              <p className="mt-2 text-gray-600">{error}</p>
            </div>
            <div className="mt-6 flex justify-center gap-4">
              <button
                onClick={() => navigate("/dashboard/purchase-history")}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                View Purchase History
              </button>
              <button
                onClick={() => navigate("/dashboard/programs")}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Back to Programs
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Success Icon */}
          <div className="text-center mb-6">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100">
              <svg
                className="h-10 w-10 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 className="mt-4 text-3xl font-bold text-gray-900">
              Payment Successful!
            </h1>
            <p className="mt-2 text-gray-600">
              Thank you for enrolling in the program
            </p>
          </div>

          {/* Bundle Promo Code Celebration - Show if present */}
          {purchase?.bundlePromoCode && (
            <div className="mb-6">
              <BundlePromoCodeCard
                code={purchase.bundlePromoCode}
                discountAmount={(purchase.bundleDiscountAmount || 5000) / 100} // Convert cents to dollars
                expiresAt={
                  purchase.bundleExpiresAt ||
                  new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
                }
                onBrowsePrograms={() => navigate("/dashboard/programs")}
              />
            </div>
          )}

          {/* Purchase Details */}
          {purchase && (
            <div className="border-t border-gray-200 pt-6 mt-6">
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    Order Number
                  </dt>
                  <dd className="mt-1 text-lg font-semibold text-gray-900">
                    {purchase.orderNumber}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">Program</dt>
                  <dd className="mt-1 text-lg text-gray-900">
                    {typeof purchase.programId === "object"
                      ? purchase.programId.title
                      : "Program"}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    Amount Paid
                  </dt>
                  <dd className="mt-1 text-2xl font-bold text-purple-600">
                    {formatCurrency(purchase.finalPrice)}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    Purchase Date
                  </dt>
                  <dd className="mt-1 text-lg text-gray-900">
                    {new Date(purchase.purchaseDate).toLocaleDateString(
                      "en-US",
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      }
                    )}
                  </dd>
                </div>
              </dl>

              {/* Show warning if purchase is still pending */}
              {purchase.status === "pending" && (
                <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>⚠️ Payment Processing:</strong> Your payment was
                    successful! The webhook is processing your purchase. The
                    page will refresh automatically when complete (usually
                    within a few seconds).
                  </p>
                </div>
              )}

              {purchase.status === "completed" && (
                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>What's Next?</strong> A confirmation email with your
                    receipt has been sent to your email address. You now have
                    full access to all events in this program.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => {
                // Extract program ID - handle multiple formats
                let programId: string | undefined;

                if (!purchase?.programId) {
                  programId = undefined;
                } else if (typeof purchase.programId === "string") {
                  programId = purchase.programId;
                } else if (typeof purchase.programId === "object") {
                  // Backend's toJSON transform converts _id to id, so check both
                  const prog = purchase.programId as {
                    id?: string;
                    _id?: string;
                  };
                  if (prog.id) {
                    programId = prog.id;
                  } else if (prog._id) {
                    programId = prog._id;
                  } else {
                    programId = undefined;
                  }
                } else {
                  programId = undefined;
                }

                if (programId) {
                  navigate(`/dashboard/programs/${programId}`);
                } else {
                  navigate("/dashboard/programs");
                }
              }}
              className="flex-1 bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors"
            >
              View Program
            </button>
            <button
              onClick={() => navigate("/dashboard/programs")}
              className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors"
            >
              Browse Programs
            </button>
            <button
              onClick={() => navigate("/dashboard/purchase-history")}
              className="flex-1 bg-white text-purple-600 px-6 py-3 rounded-lg font-semibold border-2 border-purple-600 hover:bg-purple-50 transition-colors"
            >
              Purchase History
            </button>
          </div>

          <div className="mt-4 text-center">
            <button
              onClick={() => navigate("/dashboard")}
              className="text-gray-600 hover:text-gray-900 underline"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
