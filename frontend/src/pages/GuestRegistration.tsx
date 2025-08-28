import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import GuestEventSignup from "../components/events/GuestEventSignup";
import { apiClient } from "../services/api";
import type { EventData, EventRole } from "../types/event";
import { getParticipantAllowedRoleNames } from "../utils/participantRoles";
import { formatEventDateTimeRangeInViewerTZ } from "../utils/eventStatsUtils";

export default function GuestRegistration() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const params = new URLSearchParams(location.search);
  const roleIdFromQuery = params.get("roleId") || "";

  // Local state for role selection fallback
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");

  const onSuccess = (data: any) => {
    // Include eventId so the confirmation page can fetch organizer details
    try {
      if (id) sessionStorage.setItem("lastGuestEventId", id);
    } catch (_) {
      // Non-critical: ignore storage errors
    }
    const to = id
      ? `/guest-confirmation?eventId=${encodeURIComponent(id)}`
      : "/guest-confirmation";
    navigate(to, { state: { guest: data, eventId: id } });
  };

  // If no roleId is supplied, fetch event and allow role selection
  useEffect(() => {
    if (!id || roleIdFromQuery) return; // No need to fetch if role present
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const evt = await apiClient.getEvent(id);
        if (!cancelled) {
          setEvent(evt);
        }
      } catch (e: any) {
        if (!cancelled) setLoadError(e?.message || "Failed to load event");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, roleIdFromQuery]);

  const roles: EventRole[] = useMemo(() => event?.roles || [], [event]);

  // Participant-level allowed role names (guests follow Participant rules across all event types)
  const participantAllowedRoleNames: string[] = useMemo(
    () => getParticipantAllowedRoleNames(event),
    [event]
  );

  // Roles visible/selectable to guests
  const displayRoles: EventRole[] = useMemo(() => {
    if (!roles.length || !participantAllowedRoleNames.length) return [];
    return roles.filter((r) => participantAllowedRoleNames.includes(r.name));
  }, [roles, participantAllowedRoleNames]);

  // Auto-select first allowed role when roles become available
  useEffect(() => {
    if (!roleIdFromQuery && !selectedRoleId && displayRoles.length > 0) {
      setSelectedRoleId(displayRoles[0].id);
    }
  }, [displayRoles, selectedRoleId, roleIdFromQuery]);

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

  // Otherwise render role selection UI
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
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Register as a Guest
            </h1>
            <p className="text-lg text-gray-600">
              Choose how you'd like to participate in this event
            </p>
          </div>

          {/* Content Card */}
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="p-8">
              {loading && (
                <div className="text-center py-12">
                  <div className="w-8 h-8 mx-auto mb-4 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-gray-600">Loading available roles...</p>
                </div>
              )}

              {loadError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                  <div className="w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-red-600"
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
                  <p className="text-red-600 font-medium">{loadError}</p>
                </div>
              )}

              {!loading && !loadError && displayRoles.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
                    <svg
                      className="w-8 h-8 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No Roles Available
                  </h3>
                  <p className="text-gray-600">
                    There are currently no roles available for this event.
                  </p>
                </div>
              )}

              {!loading && !loadError && displayRoles.length > 0 && event && (
                <div className="space-y-8">
                  {/* Event Title */}
                  <div className="text-center">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">
                      {event.title}
                    </h1>
                  </div>

                  {/* Event Details Section */}
                  <div className="space-y-6">
                    <h2 className="text-xl font-bold text-gray-900 border-b border-gray-200 pb-2">
                      Event Details
                    </h2>

                    {/* Basic Event Information */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center text-gray-600">
                        <svg
                          className="w-5 h-5 mr-3 flex-shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        <span>
                          {event.date
                            ? formatEventDateTimeRangeInViewerTZ(
                                event.date,
                                event.time,
                                event.endTime,
                                event.timeZone,
                                (event as any).endDate
                              )
                            : "Date TBD"}
                        </span>
                      </div>
                      <div className="flex items-center text-gray-600">
                        <svg
                          className="w-5 h-5 mr-3 flex-shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        {event.location}
                      </div>
                      <div className="flex items-center text-gray-600">
                        <svg
                          className="w-5 h-5 mr-3 flex-shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2M7 4h10M7 4L5.5 6M17 4l1.5 2M3 6h18l-2 13H5L3 6z"
                          />
                        </svg>
                        Format: {event.format}
                      </div>
                      <div className="flex items-center text-gray-600">
                        <svg
                          className="w-5 h-5 mr-3 flex-shrink-0"
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
                        Type: {event.type || "General Event"}
                      </div>
                    </div>

                    {/* Hosted By */}
                    <div>
                      <h3 className="text-md font-semibold text-gray-900 mb-2">
                        Hosted by
                      </h3>
                      <div className="flex items-center text-gray-700">
                        <img
                          src="/Cloud-removebg.png"
                          alt="@Cloud Logo"
                          className="h-5 w-auto mr-2 object-contain"
                        />
                        {event.hostedBy || "@Cloud Marketplace Ministry"}
                      </div>
                    </div>

                    {/* Purpose */}
                    <div>
                      <h3 className="text-md font-semibold text-gray-900 mb-2">
                        Purpose
                      </h3>
                      <p className="text-gray-700">{event.purpose}</p>
                    </div>

                    {/* Event Capacity */}
                    {event.totalSlots && (
                      <div>
                        <h3 className="text-md font-semibold text-gray-900 mb-2">
                          Event Capacity
                        </h3>
                        <div className="flex items-center text-gray-700">
                          <svg
                            className="w-5 h-5 mr-2 flex-shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                            />
                          </svg>
                          <span>
                            {event.totalSlots} total slots available
                            {event.signedUp !== undefined && (
                              <span className="text-gray-500 ml-2">
                                ({event.signedUp} currently signed up)
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Event Agenda */}
                    {event.agenda && (
                      <div>
                        <h3 className="text-md font-semibold text-gray-900 mb-2">
                          Event Agenda and Schedule
                        </h3>
                        <div className="text-gray-700 whitespace-pre-line bg-gray-50 p-3 rounded-md">
                          {event.agenda}
                        </div>
                      </div>
                    )}

                    {/* Requirements */}
                    {event.requirements && (
                      <div>
                        <h3 className="text-md font-semibold text-gray-900 mb-2">
                          Requirements
                        </h3>
                        <p className="text-gray-700">{event.requirements}</p>
                      </div>
                    )}

                    {/* Materials Needed */}
                    {event.materials && (
                      <div>
                        <h3 className="text-md font-semibold text-gray-900 mb-2">
                          Materials Needed
                        </h3>
                        <p className="text-gray-700">{event.materials}</p>
                      </div>
                    )}

                    {/* Organizer Contact Information */}
                    <div>
                      <h3 className="text-md font-semibold text-gray-900 mb-2">
                        Organizer Contact
                      </h3>
                      <div className="text-gray-700">
                        {event.organizer && (
                          <p className="mb-2">{event.organizer}</p>
                        )}
                        <p>
                          Contact information will be provided upon
                          registration.
                        </p>
                      </div>
                    </div>

                    {/* Disclaimer */}
                    {event.disclaimer && (
                      <div>
                        <h3 className="text-md font-semibold text-gray-900 mb-2">
                          Disclaimer
                        </h3>
                        <p className="text-gray-700">{event.disclaimer}</p>
                      </div>
                    )}

                    {/* Online Meeting Information */}
                    {(event.format === "Online" ||
                      event.format === "Hybrid Participation") && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-start">
                          <svg
                            className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                          </svg>
                          <div>
                            <h4 className="text-sm font-medium text-blue-900 mb-1">
                              Online Meeting Information
                            </h4>
                            <p className="text-sm text-blue-800">
                              Upon registration, the meeting link and event
                              details will be sent to you via email.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Guest Registration Frame */}
                  <div className="border-t border-gray-200 pt-6">
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-6">
                      <div className="flex items-center mb-4">
                        <div className="flex-shrink-0">
                          <svg
                            className="w-6 h-6 text-blue-600"
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
                        <div className="ml-3">
                          <h3 className="text-lg font-semibold text-blue-900">
                            Guest Registration
                          </h3>
                          <p className="text-sm text-blue-700">
                            Quick registration - no account required
                          </p>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div>
                          <label
                            className="block text-lg font-medium text-gray-900 mb-4"
                            htmlFor="guest-role-select"
                          >
                            Pick a role to participate in:
                          </label>
                          <div className="relative">
                            <select
                              id="guest-role-select"
                              className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white appearance-none cursor-pointer"
                              value={selectedRoleId}
                              onChange={(e) =>
                                setSelectedRoleId(e.target.value)
                              }
                            >
                              <option value="" disabled>
                                Select a role...
                              </option>
                              {displayRoles.map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.name}
                                </option>
                              ))}
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                              <svg
                                className="w-5 h-5 text-gray-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 9l-7 7-7-7"
                                />
                              </svg>
                            </div>
                          </div>
                        </div>

                        {selectedRoleId && (
                          <div className="border-t border-blue-200 pt-6">
                            <GuestEventSignup
                              eventId={id}
                              roleId={selectedRoleId}
                              onSuccess={onSuccess}
                              perspective="self"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-8">
            <p className="text-gray-500 text-sm">
              Need help?{" "}
              <a
                href="/contact"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                Contact support
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
