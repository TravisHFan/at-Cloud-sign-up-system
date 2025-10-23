import { useNavigate, useSearchParams } from "react-router-dom";

export default function PurchaseCancel() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const programId = searchParams.get("program_id");

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Cancel Icon */}
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
            <h1 className="mt-4 text-3xl font-bold text-gray-900">
              Payment Cancelled
            </h1>
            <p className="mt-2 text-gray-600">
              Your payment was cancelled and you have not been charged.
            </p>
          </div>

          {/* Information */}
          <div className="border-t border-gray-200 pt-6 mt-6">
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h3 className="text-sm font-medium text-gray-900 mb-2">
                What happened?
              </h3>
              <p className="text-sm text-gray-600">
                You cancelled the payment process before completing your
                enrollment. No charges have been made to your payment method.
              </p>
            </div>

            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-2">
                Want to enroll later?
              </h3>
              <p className="text-sm text-gray-600">
                You can return to the program page anytime to complete your
                enrollment. Early bird discounts and class representative slots
                may be limited, so enroll soon to secure the best pricing!
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row gap-4">
            {programId && (
              <button
                onClick={() =>
                  navigate(`/dashboard/programs/${programId}/enroll`)
                }
                className="flex-1 bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors"
              >
                Try Again
              </button>
            )}
            <button
              onClick={() =>
                programId
                  ? navigate(`/dashboard/programs/${programId}`)
                  : navigate("/dashboard/programs")
              }
              className="flex-1 bg-white text-gray-700 px-6 py-3 rounded-lg font-semibold border-2 border-gray-300 hover:bg-gray-50 transition-colors"
            >
              {programId ? "Back to Program" : "Browse Programs"}
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

          {/* Support Information */}
          <div className="mt-8 pt-6 border-t border-gray-200 text-center">
            <p className="text-sm text-gray-600">
              Having trouble completing your enrollment?{" "}
              <a
                href="mailto:atcloudministry@gmail.com"
                className="text-purple-600 hover:text-purple-700 font-medium"
              >
                Contact Support
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
