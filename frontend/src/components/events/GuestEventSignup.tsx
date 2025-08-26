import React from "react";
import GuestRegistrationForm from "../guest/GuestRegistrationForm";

interface Props {
  eventId: string;
  roleId: string;
  onSuccess?: (data: any) => void;
}

const GuestEventSignup: React.FC<Props> = ({ eventId, roleId, onSuccess }) => {
  return (
    <div>
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
              Guest Registration Drawbacks
            </h4>
            <ul className="text-sm text-amber-800 space-y-1">
              <li>• Limited Role Accessibility</li>
              <li>• Cannot see who else is participating in real time</li>
              <li>• Limited role management and change options</li>
              <li>• No access to event history or records</li>
              <li>• Cannot view participant lists or networking features</li>
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
  );
};
export default GuestEventSignup;
