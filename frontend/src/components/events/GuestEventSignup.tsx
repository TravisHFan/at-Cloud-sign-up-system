import React from "react";
import GuestRegistrationForm from "../guest/GuestRegistrationForm";

interface Props {
  eventId: string;
  roleId: string;
  onSuccess?: (data: any) => void;
}

const GuestEventSignup: React.FC<Props> = ({ eventId, roleId, onSuccess }) => {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center mr-4">
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white">
              Guest Registration
            </h3>
            <p className="text-blue-100 text-sm">
              Quick signup - no account required
            </p>
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="p-6">
        <div className="mb-6">
          <div className="flex items-start p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex-shrink-0">
              <svg
                className="w-5 h-5 text-blue-600 mt-0.5"
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
            </div>
            <div className="ml-3">
              <h4 className="text-sm font-medium text-blue-900 mb-1">
                Guest Registration Benefits
              </h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• No account creation needed</li>
                <li>• Instant confirmation email</li>
                <li>• Easy registration management</li>
              </ul>
            </div>
          </div>
        </div>

        <GuestRegistrationForm
          eventId={eventId}
          roleId={roleId}
          onSuccess={onSuccess}
        />
      </div>
    </div>
  );
};

export default GuestEventSignup;
