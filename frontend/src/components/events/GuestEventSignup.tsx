import React from "react";
import GuestRegistrationForm from "../guest/GuestRegistrationForm";

interface Props {
  eventId: string;
  roleId: string;
  onSuccess?: (data: any) => void;
}

const GuestEventSignup: React.FC<Props> = ({ eventId, roleId, onSuccess }) => {
  return (
    <div className="p-4 border rounded">
      <h3 className="text-lg font-semibold mb-2">Join this role as Guest</h3>
      <p className="text-sm text-gray-600 mb-3">
        No account needed. Limited features apply.
      </p>
      <GuestRegistrationForm
        eventId={eventId}
        roleId={roleId}
        onSuccess={onSuccess}
      />
    </div>
  );
};

export default GuestEventSignup;
