import { Link, useLocation } from "react-router-dom";

export default function GuestConfirmation() {
  const location = useLocation() as any;
  const details = location.state?.guest || {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Success Header */}
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-8 py-6">
            <div className="flex items-center">
              <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center mr-6">
                <svg
                  className="w-8 h-8 text-white"
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
              <div>
                <h1 className="text-3xl font-bold text-white">
                  Registration Successful!
                </h1>
                <p className="text-green-100 text-lg">
                  Welcome to the event - you're all set!
                </p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-8">
            <div className="text-center mb-8">
              <p className="text-lg text-gray-700 mb-4">
                Thanks for joining as a guest! We've successfully recorded your
                registration and sent a confirmation email with all the details.
              </p>
            </div>

            {details?.eventTitle && (
              <div className="bg-gray-50 rounded-xl p-6 border border-gray-200 mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <svg
                    className="w-5 h-5 text-gray-500 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 0V7a2 2 0 006 0V7m-6 0H6a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-2"
                    />
                  </svg>
                  Registration Details
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <span className="text-sm font-medium text-gray-600 w-20">
                      Event:
                    </span>
                    <span className="text-sm text-gray-900 font-medium">
                      {details.eventTitle}
                    </span>
                  </div>
                  {details.roleName && (
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-gray-600 w-20">
                        Role:
                      </span>
                      <span className="text-sm text-gray-900">
                        {details.roleName}
                      </span>
                    </div>
                  )}
                  {details.date && (
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-gray-600 w-20">
                        Date:
                      </span>
                      <span className="text-sm text-gray-900">
                        {details.date}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* What's Next Section */}
            <div className="bg-blue-50 rounded-xl p-6 border border-blue-200 mb-8">
              <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center">
                <svg
                  className="w-5 h-5 text-blue-600 mr-2"
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
                What's Next?
              </h3>
              <ul className="space-y-2 text-sm text-blue-800">
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
                  Check your email for confirmation and event details
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
                  Event organizers will contact you if any additional
                  information is needed
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
                  Mark your calendar and we'll see you at the event!
                </li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium transition-colors text-center flex items-center justify-center"
                to="/dashboard/upcoming"
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 0V7a2 2 0 006 0V7m-6 0H6a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-2"
                  />
                </svg>
                Browse More Events
              </Link>
              <Link
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-8 py-3 rounded-lg font-medium transition-colors text-center flex items-center justify-center"
                to="/login"
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                </svg>
                Return to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
