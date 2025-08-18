import { Link } from "react-router-dom";

export default function GuestLanding() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-lg w-full space-y-6 text-center">
        <h1 className="text-2xl font-bold">Join an Event as a Guest</h1>
        <p className="text-gray-600">
          No account needed. Pick an event and a role, share a few details, and
          you're in.
        </p>
        <div className="space-x-3">
          <Link
            className="text-blue-600 hover:underline"
            to="/dashboard/upcoming?guest=1"
          >
            Browse Upcoming Events
          </Link>
          <span className="text-gray-400">•</span>
          <Link className="text-gray-600 hover:underline" to="/login">
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
