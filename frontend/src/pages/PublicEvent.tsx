import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import apiClient from "../services/api";
import { Icon } from "../components/common";
import { ShareModal } from "../components/share/ShareModal";
import Multiline, { normalizeMultiline } from "../components/common/Multiline";
import type {
  PublicEventData,
  PublicRegistrationResponse,
} from "../types/publicEvent";
import { formatEventDateTimeRangeInViewerTZ } from "../utils/eventStatsUtils";

export default function PublicEvent() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<PublicEventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleId, setRoleId] = useState<string>("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  // Use shared singleton client (avoids duplicate configuration)

  useEffect(() => {
    let active = true;
    async function load() {
      if (!slug) return;
      setLoading(true);
      setError(null);
      try {
        try {
          const eventData = await apiClient.getPublicEvent(slug);
          if (active) setData(eventData);
        } catch (err) {
          const e = err as Error;
          if (e.message.includes("404")) {
            throw new Error("This event is not published or does not exist.");
          }
          throw e;
        }
      } catch (e) {
        const ex = e as Error;
        if (active) setError(ex.message || "Failed to load event");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    if (data?.isAuthenticated && data?.id) {
      // Redirect to internal authenticated event detail page (dashboard path)
      navigate(`/dashboard/event/${data.id}`, { replace: true });
    }
  }, [data?.isAuthenticated, data?.id, navigate]);

  if (loading) {
    return (
      <div
        className="max-w-3xl mx-auto p-6 animate-pulse"
        data-testid="public-event-loading"
      >
        <h1 className="text-xl font-semibold">Loading event...</h1>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto p-6" data-testid="public-event-error">
        <h1 className="text-2xl font-semibold mb-2">Event Not Available</h1>
        <p className="text-red-600 mb-4">{error}</p>
        <p className="text-sm text-gray-500">
          If you believe this is an error, the organizer may have unpublished or
          renamed the event.
        </p>
      </div>
    );
  }

  if (!data) return null;

  const dateRange = formatEventDateTimeRangeInViewerTZ(
    data.date,
    data.time,
    data.endTime,
    data.timeZone,
    data.endDate
  );

  // (Multiline + normalizeMultiline are now imported from shared component)

  return (
    <div className="max-w-3xl mx-auto p-6" data-testid="public-event-page">
      <header className="mb-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight mb-2">
              {data.title}
            </h1>
            <div
              className="flex items-center text-sm text-gray-600 mb-1"
              data-testid="public-event-dates"
            >
              <Icon name="calendar" className="w-4 h-4 mr-2" />
              <span>{dateRange}</span>
              {dateRange && (
                <span className="ml-2 text-xs text-gray-500">
                  (shown in your local time)
                </span>
              )}
            </div>
            <div
              className="flex items-center text-sm text-gray-600 whitespace-pre-line"
              data-testid="public-event-location"
            >
              <Icon name="map-pin" className="w-4 h-4 mr-2" />
              <span className="leading-snug">{data.location}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowShareModal(true)}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
                />
              </svg>
              Share
            </button>
            <Link
              to="/events"
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <Icon name="arrow-left" className="w-4 h-4 mr-2" />
              Browse Events
            </Link>
          </div>
        </div>
      </header>

      {data.flyerUrl && (
        <div className="mb-6">
          <img
            src={data.flyerUrl}
            alt={data.title + " flyer"}
            className="rounded shadow max-h-96 object-contain mx-auto"
            loading="lazy"
          />
        </div>
      )}

      {data.purpose && (
        <section className="mb-6" data-testid="public-event-purpose">
          <h2 className="text-xl font-semibold mb-2">About This Event</h2>
          <Multiline text={data.purpose} />
        </section>
      )}

      {data.agenda && (
        <section className="mb-6" data-testid="public-event-agenda">
          <h2 className="text-xl font-semibold mb-2">Agenda</h2>
          {(() => {
            const normalized = normalizeMultiline(data.agenda);
            // Split on newline and render each line as its own block for consistent spacing
            const lines = normalized
              .split(/\n+/)
              .map((l) => l.trim())
              .filter(Boolean);
            return (
              <div className="space-y-1">
                {lines.map((line, idx) => (
                  <p key={idx} className="leading-relaxed">
                    {line}
                  </p>
                ))}
              </div>
            );
          })()}
        </section>
      )}

      {data.disclaimer && (
        <section className="mb-6" data-testid="public-event-disclaimer">
          <h2 className="text-xl font-semibold mb-2">Disclaimer</h2>
          <Multiline text={data.disclaimer} />
        </section>
      )}

      <section className="mb-8" data-testid="public-event-roles">
        <h2 className="text-xl font-semibold mb-3">Available Roles</h2>
        {!data.isAuthenticated && (
          <div
            className="mb-4 p-4 border border-blue-200 rounded-md bg-blue-50 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
            data-testid="public-event-login-prompt"
          >
            <p className="text-sm text-blue-800 leading-relaxed">
              Register below to save time, or log in/sign up first to view
              additional event details and role assignments.
            </p>
            <Link
              to={`/login?redirect=/dashboard/event/${data.id}`}
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 whitespace-nowrap"
            >
              Log In
            </Link>
          </div>
        )}
        {data.roles.length === 0 && (
          <p className="text-sm text-gray-500">
            No public roles are available for this event.
          </p>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          {data.roles.map((r) => {
            const isFull = r.capacityRemaining === 0;
            const isSelected = roleId === r.roleId;
            const capacityPercentage =
              ((r.maxParticipants - r.capacityRemaining) / r.maxParticipants) *
              100;

            return (
              <div
                key={r.roleId}
                className={`border-2 rounded-lg p-4 transition-all cursor-pointer ${
                  isSelected
                    ? "border-blue-500 bg-blue-50"
                    : isFull
                    ? "border-gray-200 bg-gray-50 opacity-60"
                    : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
                }`}
                onClick={() => {
                  if (isFull || submitting) return;
                  // If a previous registration succeeded (resultMsg shown and not error), reset form for a new registration
                  if (
                    resultMsg &&
                    !resultMsg.toLowerCase().includes("error") &&
                    !resultMsg.toLowerCase().includes("failed")
                  ) {
                    setResultMsg(null);
                    setDuplicate(false);
                    setName("");
                    setEmail("");
                    setPhone("");
                  }
                  setRoleId(r.roleId);
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg text-gray-900">
                        {r.name}
                      </h3>
                      {isSelected && (
                        <Icon
                          name="check-circle"
                          className="w-5 h-5 text-green-600"
                        />
                      )}
                      {isFull && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Full
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-3 whitespace-pre-line">
                      {normalizeMultiline(r.description)}
                    </p>

                    {/* Capacity Bar */}
                    <div className="mb-2">
                      <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                        <span>Capacity</span>
                        <span>
                          {r.maxParticipants - r.capacityRemaining}/
                          {r.maxParticipants} registered
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            capacityPercentage >= 90
                              ? "bg-red-500"
                              : capacityPercentage >= 70
                              ? "bg-yellow-500"
                              : "bg-green-500"
                          }`}
                          style={{ width: `${capacityPercentage}%` }}
                        />
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {r.capacityRemaining > 0 ? (
                          <span className="text-green-600 font-medium">
                            {r.capacityRemaining} spots available
                          </span>
                        ) : (
                          <span className="text-red-600 font-medium">
                            No spots available
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <div className="mt-3">
                  <button
                    type="button"
                    disabled={submitting || isFull}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isFull) setRoleId(r.roleId);
                    }}
                    className={`w-full px-4 py-2 text-sm font-medium rounded-md border transition-colors ${
                      isSelected
                        ? "bg-blue-600 text-white border-blue-600"
                        : isFull
                        ? "bg-gray-200 text-gray-500 border-gray-200 cursor-not-allowed"
                        : "bg-white text-blue-700 border-blue-300 hover:bg-blue-50"
                    }`}
                  >
                    {isSelected
                      ? "Selected"
                      : isFull
                      ? "Full"
                      : "Select This Role"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mb-10" data-testid="public-event-registration-form">
        <h2 className="text-xl font-semibold mb-4">Register</h2>
        {!roleId && (
          <p className="text-sm text-gray-600 mb-4">
            Select a role above to begin registration.
          </p>
        )}
        {roleId && !resultMsg && (
          <form
            className="space-y-4 max-w-md"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!slug) return;
              setSubmitting(true);
              setResultMsg(null);
              setDuplicate(false);
              try {
                const res: PublicRegistrationResponse =
                  await apiClient.registerForPublicEvent(slug, {
                    roleId,
                    attendee: { name, email, phone: phone || undefined },
                    consent: { termsAccepted: true },
                  });
                setDuplicate(!!res.duplicate);
                setResultMsg(
                  res.message ||
                    (res.duplicate
                      ? "Already registered"
                      : "Registered successfully")
                );
                // Immediately reflect capacity change locally so user sees updated numbers without reload
                if (!res.duplicate) {
                  setData((prev) => {
                    if (!prev) return prev;
                    return {
                      ...prev,
                      roles: prev.roles.map((r) =>
                        r.roleId === roleId && r.capacityRemaining > 0
                          ? {
                              ...r,
                              capacityRemaining: r.capacityRemaining - 1,
                            }
                          : r
                      ),
                    };
                  });
                }
              } catch (err) {
                const e = err as Error;
                setResultMsg(e.message || "Registration failed");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            <div>
              <label
                htmlFor="public-reg-full-name"
                className="block text-sm font-medium mb-1"
              >
                Full Name
              </label>
              <input
                id="public-reg-full-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring focus:border-indigo-500"
                placeholder="Your name"
              />
            </div>
            <div>
              <label
                htmlFor="public-reg-email"
                className="block text-sm font-medium mb-1"
              >
                Email
              </label>
              <input
                id="public-reg-email"
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring focus:border-indigo-500"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label
                htmlFor="public-reg-phone"
                className="block text-sm font-medium mb-1"
              >
                Phone{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                id="public-reg-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring focus:border-indigo-500"
                placeholder="+1 555 0100"
              />
            </div>
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting || !name || !email}
                className="inline-flex items-center px-4 py-2 rounded bg-indigo-600 text-white text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors"
              >
                {submitting ? "Submitting..." : "Submit Registration"}
              </button>
            </div>
          </form>
        )}
        {resultMsg && (
          <div
            className={`max-w-md p-4 border rounded text-sm mt-4 ${
              resultMsg.toLowerCase().includes("error") ||
              resultMsg.toLowerCase().includes("failed")
                ? "bg-red-50 border-red-200 text-red-800"
                : "bg-green-50 border-green-200 text-green-800"
            }`}
          >
            <div className="flex items-start gap-3">
              <Icon
                name={
                  resultMsg.toLowerCase().includes("error") ||
                  resultMsg.toLowerCase().includes("failed")
                    ? "x-circle"
                    : "check-circle"
                }
                className="w-5 h-5 flex-shrink-0 mt-0.5"
              />
              <div className="flex-1">
                <p className="font-medium mb-1">{resultMsg}</p>
                {!resultMsg.toLowerCase().includes("error") &&
                  !resultMsg.toLowerCase().includes("failed") &&
                  (duplicate ? (
                    <p className="text-sm opacity-80">
                      You were already registered for this role. We've sent
                      another confirmation email.
                    </p>
                  ) : (
                    <p className="text-sm opacity-80">
                      Check your email for a confirmation with event details and
                      calendar invite.
                    </p>
                  ))}
              </div>
            </div>
          </div>
        )}
      </section>

      <footer
        className="pt-4 border-t text-xs text-gray-500"
        data-testid="public-event-footer"
      >
        <p>Public event — registration powered by early public endpoint.</p>
      </footer>

      {/* Share Modal */}
      {data && (
        <ShareModal
          eventId={data.id}
          publicSlug={data.slug}
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
}
