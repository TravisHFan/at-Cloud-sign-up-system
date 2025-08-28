import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { apiClient } from "../services/api";

// Narrow types used in this page to avoid any
interface GuestDetails {
  eventTitle?: string;
  roleName?: string;
  date?: string;
}

interface Organizer {
  name?: string;
  fullName?: string;
  role?: string;
  email?: string;
  phone?: string;
  avatar?: string;
  gender?: string;
}

export default function GuestConfirmation() {
  const location = useLocation();
  const state = (location.state ?? {}) as {
    guest?: GuestDetails;
    eventId?: string;
  };
  const details = state.guest || {};
  // Prefer eventId from navigation state; fallback to URL query (?eventId=) or sessionStorage
  const searchParams = new URLSearchParams(
    location.search || window.location.search
  );
  const eventIdFromQuery = searchParams.get("eventId") || undefined;
  const eventIdFromState = state.eventId || undefined;
  const storedEventId = ((): string | undefined => {
    try {
      return sessionStorage.getItem("lastGuestEventId") || undefined;
    } catch {
      return undefined;
    }
  })();
  const eventId = eventIdFromState || eventIdFromQuery || storedEventId;

  const [organizers, setOrganizers] = useState<Organizer[] | null>(null);
  const [loadingOrg, setLoadingOrg] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!eventId) return;
      setLoadingOrg(true);
      try {
        const evt = await apiClient.getEvent(eventId);
        if (!cancelled) {
          const arrRaw = (evt as { organizerDetails?: unknown })
            .organizerDetails;
          const arr: Organizer[] = Array.isArray(arrRaw)
            ? (arrRaw as Organizer[])
            : [];
          const list: Organizer[] = [];
          // Always include primary Organizer from createdBy if available
          const cb = (
            evt as {
              createdBy?: {
                email?: string;
                phone?: string;
                firstName?: string;
                lastName?: string;
                username?: string;
                avatar?: string;
                gender?: string;
              };
            }
          ).createdBy;
          if (cb && (cb.email || cb.phone)) {
            const name =
              [cb.firstName, cb.lastName].filter(Boolean).join(" ") ||
              cb.username ||
              "Organizer";
            list.push({
              name,
              role: "Organizer",
              email: cb.email || "",
              phone: cb.phone || "",
              avatar: cb.avatar,
              gender: cb.gender,
            });
          }
          // Append any organizerDetails (typically co-organizers)
          for (const o of arr) {
            // Avoid duplicate if same email as createdBy
            if (
              !list.some(
                (x) => x.email && o.email && String(x.email) === String(o.email)
              )
            ) {
              list.push(o);
            }
          }
          setOrganizers(list);
          // Cache for subsequent visits in case of hard refresh
          try {
            sessionStorage.setItem("lastGuestEventId", eventId);
          } catch {
            // Best-effort cache; safe to ignore storage errors
          }
        }
      } catch {
        // Network or fetch error; fall back to empty organizer list
        if (!cancelled) setOrganizers([]);
      } finally {
        if (!cancelled) setLoadingOrg(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

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

            {/* Organizer Contact Information */}
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
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                Organizer Contact
              </h3>
              {loadingOrg ? (
                <p className="text-sm text-gray-600">
                  Loading organizer details…
                </p>
              ) : organizers && organizers.length > 0 ? (
                <ul className="space-y-3">
                  {organizers.map((o, idx) => (
                    <li key={idx} className="flex items-start">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">
                          {o.name || o.fullName || "Organizer"}
                          {o.role ? (
                            <span className="text-gray-600 font-normal">
                              {" "}
                              {`(${o.role})`}
                            </span>
                          ) : null}
                        </div>
                        <div className="text-sm text-gray-700">
                          {o.email && (
                            <span>
                              Email:{" "}
                              <a
                                className="text-blue-600 hover:underline"
                                href={`mailto:${o.email}`}
                              >
                                {o.email}
                              </a>
                            </span>
                          )}
                          {o.phone ? (
                            <span>
                              {o.email ? ", " : ""}
                              Phone: {o.phone}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-700">
                  Contact information will be provided upon registration.
                </p>
              )}
            </div>

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
