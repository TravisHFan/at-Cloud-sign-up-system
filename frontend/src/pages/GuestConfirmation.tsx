import { Link, useLocation } from "react-router-dom";

export default function GuestConfirmation() {
  const location = useLocation() as any;
  const details = location.state?.guest || {};

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-lg w-full space-y-6">
        <h1 className="text-2xl font-bold text-green-700">
          You're registered!
        </h1>
        <p className="text-gray-700">
          Thanks for joining as a guest. We've recorded your registration.
        </p>
        {details?.eventTitle && (
          <div className="bg-gray-50 p-4 rounded border">
            <div className="font-medium">{details.eventTitle}</div>
            {details.roleName && (
              <div className="text-sm text-gray-600">
                Role: {details.roleName}
              </div>
            )}
            {details.date && (
              <div className="text-sm text-gray-600">Date: {details.date}</div>
            )}
          </div>
        )}
        <div className="flex items-center gap-4">
          <Link
            className="text-blue-600 hover:underline"
            to="/dashboard/upcoming"
          >
            View More Events
          </Link>
          <Link className="text-gray-600 hover:underline" to="/login">
            Return to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
