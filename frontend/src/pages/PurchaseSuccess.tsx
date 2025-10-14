import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { purchaseService } from "../services/api";

interface Purchase {
  id: string;
  orderNumber: string;
  program: {
    id: string;
    title: string;
  };
  amount: number;
  purchaseDate: string;
}

export default function PurchaseSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sessionId = searchParams.get("session_id");

    if (!sessionId) {
      alert("Invalid payment session");
      navigate("/dashboard/programs");
      return;
    }

    const loadPurchase = async () => {
      try {
        setLoading(true);
        // Fetch the latest purchases to find the one from this session
        const purchases = await purchaseService.getMyPurchases();

        // Get the most recent purchase (likely the one just completed)
        if (purchases.length > 0) {
          setPurchase(purchases[0] as Purchase);
        } else {
          throw new Error("Purchase not found");
        }
      } catch (error) {
        console.error("Error loading purchase:", error);
        alert("Failed to load purchase details");
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
                    {purchase.program.title}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    Amount Paid
                  </dt>
                  <dd className="mt-1 text-2xl font-bold text-purple-600">
                    ${(purchase.amount / 100).toFixed(2)}
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

              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>What's Next?</strong> A confirmation email with your
                  receipt has been sent to your email address. You now have full
                  access to all events in this program.
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row gap-4">
            <button
              onClick={() =>
                purchase
                  ? navigate(`/dashboard/programs/${purchase.program.id}`)
                  : navigate("/dashboard/programs")
              }
              className="flex-1 bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors"
            >
              View Program
            </button>
            <button
              onClick={() => navigate("/dashboard/purchase-history")}
              className="flex-1 bg-white text-purple-600 px-6 py-3 rounded-lg font-semibold border-2 border-purple-600 hover:bg-purple-50 transition-colors"
            >
              View Purchase History
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
