import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Icon } from "../components/common";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { purchaseService } from "../services/api";

interface Purchase {
  id: string;
  orderNumber: string;
  status: string;
  eventId?: {
    id: string;
    title: string;
  };
  purchaseDate: string;
}

export default function EventPurchaseSuccess() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    if (!sessionId) {
      navigate("/dashboard");
      return;
    }

    const loadPurchase = async (retryCount = 0) => {
      try {
        setLoading(true);
        setError(null);

        // Verify the session and get purchase data
        const purchaseData = await purchaseService.verifySession(sessionId);
        setPurchase(purchaseData as Purchase);
      } catch (err) {
        console.error("Error verifying purchase:", err);

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
  }, [sessionId, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <LoadingSpinner size="lg" inline />
          <p className="mt-4 text-gray-600">Verifying your purchase...</p>
        </div>
      </div>
    );
  }

  // Show error state if purchase couldn't be loaded after retries
  if (error) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <div className="mb-6">
            <div className="w-16 h-16 mx-auto bg-yellow-100 rounded-full flex items-center justify-center mb-4">
              <Icon name="x-circle" className="w-10 h-10 text-yellow-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Payment Processing
            </h2>
            <p className="text-gray-600 mb-6">{error}</p>
          </div>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => navigate("/dashboard/purchase-history")}
              className="bg-purple-600 text-white px-6 py-2 rounded-md hover:bg-purple-700"
            >
              View Purchase History
            </button>
            <button
              onClick={() => navigate("/dashboard")}
              className="bg-gray-200 text-gray-700 px-6 py-2 rounded-md hover:bg-gray-300"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!purchase) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <Icon
            name="x-circle"
            className="w-16 h-16 mx-auto text-red-600 mb-4"
          />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Payment Verification Failed
          </h2>
          <p className="text-gray-600 mb-6">
            We couldn't verify your payment. Please contact support if you
            believe this is an error.
          </p>
          <button
            onClick={() => navigate("/dashboard")}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-12">
      <div className="bg-white rounded-lg shadow-sm p-8 text-center">
        {/* Success Icon */}
        <div className="mb-6">
          <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
            <Icon name="check-circle" className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Purchase Successful!
          </h1>
          <p className="text-lg text-gray-600">
            Thank you for your purchase. Your payment has been processed
            successfully.
          </p>
        </div>

        {/* Details */}
        <div className="bg-gray-50 rounded-lg p-6 mb-6 text-left">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            What's Next?
          </h2>
          <ul className="space-y-3 text-gray-700">
            <li className="flex items-start gap-3">
              <Icon
                name="check-circle"
                className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0"
              />
              <span>
                You now have full access to the event details and can register
                for available roles.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Icon
                name="check-circle"
                className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0"
              />
              <span>
                A confirmation email has been sent to your registered email
                address.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Icon
                name="check-circle"
                className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0"
              />
              <span>
                You can view your purchase history in your profile settings.
              </span>
            </li>
          </ul>
        </div>

        {/* Show warning if purchase is still pending */}
        {purchase.status === "pending" && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>⚠️ Payment Processing:</strong> Your payment was
              successful! The webhook is processing your purchase. The page will
              refresh automatically when complete (usually within a few
              seconds).
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate(`/dashboard/event/${id}`)}
            className="bg-blue-600 text-white px-8 py-3 rounded-md hover:bg-blue-700 font-medium"
          >
            View Event Details
          </button>
          <button
            onClick={() => navigate("/dashboard")}
            className="bg-gray-200 text-gray-700 px-8 py-3 rounded-md hover:bg-gray-300 font-medium"
          >
            Back to Dashboard
          </button>
        </div>

        {/* Session ID Reference */}
        {sessionId && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              Transaction ID: {sessionId.substring(0, 20)}...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
