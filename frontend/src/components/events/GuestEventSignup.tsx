import React from "react";
import GuestRegistrationForm from "../guest/GuestRegistrationForm";

interface Props {
  eventId: string;
  roleId: string;
  onSuccess?: (data: { registrationId: string }) => void;
  showLimitations?: boolean; // New prop to control whether to show limitations
  perspective?: "self" | "inviter"; // Controls label perspective in the form
}

const GuestEventSignup: React.FC<Props> = ({
  eventId,
  roleId,
  onSuccess,
  showLimitations = true,
  perspective = "self",
}) => {
  return (
    <div>
      {showLimitations && (
        <div className="mb-6">
          <div className="flex items-start p-4 bg-amber-50 rounded-lg border border-amber-200">
            <div className="flex-shrink-0">
              <svg
                className="w-5 h-5 text-amber-600 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h4 className="text-sm font-medium text-amber-900 mb-1">
                Guest Registration Limitations
              </h4>
              <ul className="text-sm text-amber-800 space-y-1">
                <li>• Limited Role Accessibility for guests</li>
                <li>
                  • Guest cannot see who else is participating in real time
                </li>
                <li>• Limited role management and change options for guests</li>
                <li>• Guest has no access to event history or records</li>
                <li>
                  • Guest cannot view participant lists or networking features
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      <GuestRegistrationForm
        eventId={eventId}
        roleId={roleId}
        onSuccess={onSuccess}
        perspective={perspective}
      />
    </div>
  );
};
export default GuestEventSignup;
