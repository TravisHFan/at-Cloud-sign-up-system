import { useNavigate, useParams, useLocation } from "react-router-dom";
import GuestEventSignup from "../components/events/GuestEventSignup";

export default function GuestRegistration() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const params = new URLSearchParams(location.search);
  const roleIdFromQuery = params.get("roleId") || "";

  const onSuccess = (_data: { registrationId: string }) => {
    // Include eventId so the confirmation page can fetch organizer details
    try {
      if (id) sessionStorage.setItem("lastGuestEventId", id);
    } catch {
      // Non-critical: ignore storage errors
    }
    const to = id
      ? `/guest-confirmation?eventId=${encodeURIComponent(id)}`
      : "/guest-confirmation";
    // Pass context to distinguish organizer-initiated vs guest self-registration
    const isOrganizerInvitation = Boolean(roleIdFromQuery);
    navigate(to, {
      state: { guest: _data, eventId: id, isOrganizerInvitation },
    });
  };

  if (!id) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
        <div className="max-w-lg w-full">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-red-600"
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
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Event Not Found
            </h1>
            <p className="text-gray-600 mb-6">
              We couldn't find the event you're looking for. Please check your
              link and try again.
            </p>
            <button
              onClick={() => window.history.back()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If role is present in query, render signup directly (invitation flow)
  if (roleIdFromQuery) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="w-20 h-20 mx-auto mb-6 bg-blue-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-10 h-10 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Invite a Guest
              </h1>
              <p className="text-lg text-gray-600">
                Register a guest for this event - no account required
              </p>
            </div>

            <GuestEventSignup
              eventId={id}
              roleId={roleIdFromQuery}
              onSuccess={onSuccess}
              showLimitations={false} // Hide limitations for invitation flow
              perspective="inviter"
            />
          </div>
        </div>
      </div>
    );
  }

  // Guest self-registration has been removed from dashboard
  // This route now only supports organizer invitations (with roleId parameter)
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center p-6">
      <div className="max-w-lg w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 14c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Invalid Access
          </h1>
          <p className="text-gray-600 mb-6">
            This page can only be accessed through organizer invitations. For
            guest self-registration, please visit the public event pages.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => navigate("/guest")}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Browse Public Events
            </button>
            <button
              onClick={() => navigate("/")}
              className="w-full px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
