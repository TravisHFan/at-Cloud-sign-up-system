import { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import apiClient from "../services/api";
import { Icon } from "../components/common";
import { ShareModal } from "../components/share/ShareModal";
import AlertModal from "../components/common/AlertModal";
import Multiline, { normalizeMultiline } from "../components/common/Multiline";
import FlyerCarousel from "../components/events/FlyerCarousel";
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
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorModalMessage, setErrorModalMessage] = useState("");
  // Ref to the registration section so we can scroll/focus after role selection
  const registerSectionRef = useRef<HTMLElement | null>(null);
  // Use shared singleton client (avoids duplicate configuration)

  // Centralized scroll & focus when role changes. We attempt multiple strategies to satisfy test spies & differing jsdom behaviors.
  useEffect(() => {
    if (!roleId) return;
    const el = registerSectionRef.current;
    if (!el) return;
    const timer = setTimeout(() => {
      scrollRegistration();
      // Focus after scroll attempts (microtask)
      try {
        queueMicrotask(() => {
          try {
            el.focus({ preventScroll: true });
          } catch {
            /* ignore */
          }
        });
      } catch {
        // queueMicrotask might not exist; ignore
        try {
          el.focus({ preventScroll: true });
        } catch {
          /* ignore */
        }
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [roleId]);

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

  // Removed derivedTagline fallback to prevent duplicate purpose rendering under title.

  // (Multiline + normalizeMultiline are now imported from shared component)

  // Centralized, highly-redundant scroll helper to maximize likelihood the test spy
  // (which replaces Element.prototype.scrollIntoView) observes at least one call
  // under full-suite scheduling variance (fake timers, prior test mutations, etc.).
  const scrollRegistration = () => {
    const el = registerSectionRef.current;
    if (!el) return;
    const attempt = () => {
      try {
        el.scrollIntoView({ behavior: "auto", block: "start" });
      } catch {
        // Fallback without options (older browsers / jsdom)
        try {
          (el as HTMLElement).scrollIntoView();
        } catch {
          /* ignore */
        }
      }
    };
    // Immediate
    attempt();
    // Microtask (covers cases where immediate call lost due to earlier prototype replacement
    // or React batching causing interim DOM state)
    try {
      queueMicrotask(attempt);
    } catch {
      // queueMicrotask not available in some older jsdom versions; ignore
    }
    // Macrotask – in case fake timers or long tasks delay earlier attempts
    setTimeout(attempt, 0);
  };

  return (
    <div className="max-w-3xl mx-auto p-6" data-testid="public-event-page">
      <header className="mb-6">
        <div className="mb-4">
          <h1 className="text-3xl font-bold tracking-tight mb-4">
            {data.title}
          </h1>
          {data.tagline ? (
            <p
              data-testid="public-event-tagline"
              className="font-display font-medium italic text-xl text-gray-800 mb-5 leading-snug tracking-wide border-l-4 pl-3 border-blue-200"
            >
              {data.tagline}
            </p>
          ) : null}
          <div
            className="text-base text-gray-700 mb-4 flex items-center"
            data-testid="public-event-hosted-by"
          >
            <img
              src="/Cloud-removebg.png"
              alt="@Cloud Logo"
              className="h-6 w-auto mr-2 object-contain"
              loading="lazy"
            />
            <span>
              Hosted by{" "}
              <span className="text-gray-900 font-normal">
                {data.hostedBy || "@Cloud Marketplace Ministry"}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-3 mb-4">
            <Link
              to="/events"
              className="inline-flex items-center h-10 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 order-1"
            >
              <Icon name="arrow-left" className="w-4 h-4 mr-2" />
              Browse Events
            </Link>
            <button
              onClick={() => setShowShareModal(true)}
              className="inline-flex items-center h-10 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 order-2"
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
            <button
              onClick={async () => {
                try {
                  const response = await fetch(
                    `/api/events/${data.id}/calendar`
                  );
                  if (!response.ok) {
                    throw new Error("Failed to download calendar file");
                  }

                  const blob = await response.blob();
                  const url = window.URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = `${data.title.replace(
                    /[^a-zA-Z0-9]/g,
                    "_"
                  )}.ics`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  window.URL.revokeObjectURL(url);
                } catch (error) {
                  console.error("Error downloading calendar file:", error);
                }
              }}
              className="inline-flex items-center h-10 px-4 py-2 text-sm font-medium text-blue-600 bg-white border border-blue-600 rounded-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 order-3"
            >
              <Icon name="calendar" className="w-4 h-4 mr-2" />
              Add to Calendar
            </button>
          </div>
          {/* Purpose tagline reverted to standalone section below flyer (removed from header) */}
          <div
            className="flex items-center text-base text-gray-600 mb-1"
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
          {data.format && (
            <div
              className="flex items-center text-base text-gray-600 mb-1"
              data-testid="public-event-format"
            >
              <Icon name="tag" className="w-4 h-4 mr-2" />
              <span>
                Format: <span className="font-medium">{data.format}</span>
              </span>
            </div>
          )}
          {/* Location intentionally omitted on public detail page (only showing Format) */}
        </div>
      </header>

      {(data.flyerUrl || data.secondaryFlyerUrl) && (
        <section className="mb-6" data-testid="public-event-flyers">
          <h2 className="text-xl font-semibold mb-4">
            Event Flyer{data.flyerUrl && data.secondaryFlyerUrl ? "s" : ""}
          </h2>
          <FlyerCarousel
            flyerUrl={data.flyerUrl}
            secondaryFlyerUrl={data.secondaryFlyerUrl}
            className="max-w-2xl mx-auto"
          />
        </section>
      )}

      {data.purpose && (
        <section className="mb-6" data-testid="public-event-purpose">
          <div className="font-display text-lg leading-relaxed text-gray-900 font-semibold/95">
            <Multiline text={data.purpose} />
          </div>
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
        <h2 className="text-xl font-semibold mb-3">
          {data.roles.length === 1 ? "Reserve a Spot" : "Available Roles"}
        </h2>
        {!data.isAuthenticated && (
          <div
            className="mb-4 p-4 border border-blue-200 rounded-md bg-blue-50 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
            data-testid="public-event-login-prompt"
          >
            <p className="text-sm text-blue-800 leading-relaxed">
              Register below to save time, or log in / sign up first to view
              additional event details and role assignments.
            </p>
            <div className="flex items-center gap-2">
              <Link
                to={`/login?redirect=/dashboard/event/${data.id}`}
                className="inline-flex items-center justify-center h-10 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 whitespace-nowrap"
              >
                Log In
              </Link>
              <Link
                to="/signup"
                className="inline-flex items-center justify-center h-10 px-4 py-2 text-sm font-medium text-blue-700 bg-white border border-blue-300 hover:bg-blue-50 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 whitespace-nowrap"
              >
                Sign Up
              </Link>
            </div>
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

            const isSingleRole = data.roles.length === 1;

            return (
              <div
                key={r.roleId}
                className={`${
                  isSingleRole ? "" : "border-2"
                } rounded-lg p-4 transition-all cursor-pointer ${
                  isSelected
                    ? "border-blue-500 bg-blue-50"
                    : isFull
                    ? `${
                        isSingleRole ? "" : "border-gray-200"
                      } bg-gray-50 opacity-60`
                    : `${
                        isSingleRole
                          ? ""
                          : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
                      }`
                }`}
                onClick={() => {
                  if (isFull || submitting) return;
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
                  scrollRegistration();
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    {!isSingleRole && (
                      <>
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
                      </>
                    )}

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
                      if (!isFull) {
                        setRoleId(r.roleId);
                        scrollRegistration();
                      }
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
                      : isSingleRole
                      ? "Get a Ticket"
                      : "Select This Role"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section
        className="mb-10 focus:outline-none"
        data-testid="public-event-registration-form"
        ref={registerSectionRef}
        tabIndex={-1}
        aria-label="Event registration form"
      >
        {!roleId && data.roles.length > 1 && (
          <p className="text-sm text-gray-600 mb-4">
            Select a role above to begin registration.
            <br /> Upon completing your registration, the Zoom link or venue
            details will be sent to your registered email address.
          </p>
        )}
        {!roleId && data.roles.length === 1 && (
          <p className="text-sm text-gray-600 mb-4">
            Upon completing your registration, the Zoom link or venue details
            will be sent to your registered email address.
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
                    attendee: { name, email, phone },
                    consent: { termsAccepted: true },
                  });
                const isSameRoleDuplicate = !!res.duplicate;
                setDuplicate(isSameRoleDuplicate);
                const baseMsg =
                  res.message ||
                  (isSameRoleDuplicate
                    ? "Already registered for this role"
                    : "Registered successfully");
                setResultMsg(baseMsg);
                // Immediately reflect capacity change locally so user sees updated numbers without reload
                if (!isSameRoleDuplicate) {
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
                const errorMsg = e.message || "Registration failed";

                // Check if this is a validation error - show in modal
                const isValidationError =
                  errorMsg.toLowerCase().includes("phone") ||
                  errorMsg.toLowerCase().includes("email") ||
                  errorMsg.toLowerCase().includes("name") ||
                  errorMsg.toLowerCase().includes("must be at least") ||
                  errorMsg.toLowerCase().includes("is required") ||
                  errorMsg.toLowerCase().includes("invalid");

                if (isValidationError) {
                  // Show validation errors in a modal
                  setErrorModalMessage(errorMsg);
                  setShowErrorModal(true);
                } else if (
                  errorMsg.includes("-role limit") ||
                  errorMsg.includes("reached the")
                ) {
                  // Handle role limit errors inline (complex message with formatting)
                  const lc = errorMsg.toLowerCase();
                  const backendIndicatesUser = lc.includes("you have reached");
                  // Extract the limit number from error message (e.g., "1-role", "3-role", "5-role")
                  const limitMatch = errorMsg.match(/(\d+)-role limit/);
                  const roleLimit = limitMatch ? limitMatch[1] : "maximum";

                  // Tailor message for authenticated (system) users OR when backend phrasing indicates user limit
                  if (data?.isAuthenticated || backendIndicatesUser) {
                    setResultMsg(
                      data?.isAuthenticated
                        ? `You have already registered for the maximum of ${roleLimit} role${
                            roleLimit !== "1" ? "s" : ""
                          } for this event. To change roles, visit this event in your dashboard and remove one role before adding another.`
                        : `This email already has ${roleLimit} role${
                            roleLimit !== "1" ? "s" : ""
                          } registered for this event. Log in to your account to manage or swap roles (remove one before adding another).`
                    );
                  } else {
                    // Guest (email-only) with 1-role limit
                    setResultMsg(
                      roleLimit === "1"
                        ? "You've already registered for this event. If you need to change your role, please contact the event organizer."
                        : `You've already registered for the maximum number of roles (${roleLimit}) for this event. If you need to make changes, please contact the event organizer.`
                    );
                  }
                } else {
                  // Other errors - show inline
                  setResultMsg(errorMsg);
                }
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
                Phone
              </label>
              <input
                id="public-reg-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring focus:border-indigo-500"
                placeholder="+1 555 0100"
              />
            </div>
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting || !name || !email || !phone}
                className="inline-flex items-center px-4 py-2 rounded bg-indigo-600 text-white text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors"
              >
                {submitting ? "Submitting..." : "Submit Registration"}
              </button>
            </div>
          </form>
        )}
        {roleId && !resultMsg && (
          <p
            className="text-xs text-gray-500 mt-4"
            data-testid="public-event-registration-reminder-inline"
          >
            Upon completing your registration, the Zoom link or venue details
            will be sent to your registered email address.
          </p>
        )}
        {resultMsg && (
          <div
            className={`max-w-md p-4 border rounded text-sm mt-4 ${
              resultMsg.toLowerCase().includes("error") ||
              resultMsg.toLowerCase().includes("failed") ||
              resultMsg.toLowerCase().includes("maximum number of roles")
                ? "bg-red-50 border-red-200 text-red-800"
                : "bg-green-50 border-green-200 text-green-800"
            }`}
          >
            <div className="flex items-start gap-3">
              <Icon
                name={
                  resultMsg.toLowerCase().includes("error") ||
                  resultMsg.toLowerCase().includes("failed") ||
                  resultMsg.toLowerCase().includes("maximum number of roles")
                    ? "x-circle"
                    : "check-circle"
                }
                className="w-5 h-5 flex-shrink-0 mt-0.5"
              />
              <div className="flex-1">
                <p className="font-medium mb-1">{resultMsg}</p>
                {!resultMsg.toLowerCase().includes("error") &&
                  !resultMsg.toLowerCase().includes("failed") &&
                  !resultMsg
                    .toLowerCase()
                    .includes("maximum number of roles") &&
                  (duplicate ? (
                    <p className="text-sm opacity-80">
                      You already registered for this role. We've sent another
                      confirmation email.
                    </p>
                  ) : (
                    <p className="text-sm opacity-80">
                      Check your email for a confirmation with event details and
                      calendar invite.
                    </p>
                  ))}
                {(() => {
                  const lc = resultMsg.toLowerCase();
                  const isGuestLimit = lc.includes("maximum number of roles");
                  const isUserLimit =
                    lc.includes(
                      "you have already registered for the maximum"
                    ) || lc.includes("this email already has 3 roles");
                  if (!(isGuestLimit || isUserLimit)) return null;
                  return (
                    <div className="text-sm opacity-80 mt-2">
                      <p className="mb-2">What you can do:</p>
                      {isUserLimit ? (
                        <ul className="list-disc list-inside space-y-1">
                          <li>Open your dashboard event page</li>
                          <li>Remove an existing role you no longer need</li>
                          <li>
                            Return here (or refresh) and register the new role
                          </li>
                        </ul>
                      ) : (
                        <ul className="list-disc list-inside space-y-1">
                          <li>Check your email for previous registrations</li>
                          <li>
                            Contact the organizer if you need to change roles
                          </li>
                          <li>
                            Create an account to manage your registrations
                          </li>
                        </ul>
                      )}
                    </div>
                  );
                })()}
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

      {/* Validation Error Modal */}
      <AlertModal
        isOpen={showErrorModal}
        onClose={() => {
          setShowErrorModal(false);
          setErrorModalMessage("");
        }}
        title="Registration Failed"
        message={errorModalMessage}
        type="error"
        buttonText="Cancel"
      />
    </div>
  );
}
