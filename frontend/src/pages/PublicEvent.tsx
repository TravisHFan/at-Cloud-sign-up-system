import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import apiClient from "../services/api";

interface PublicEventRole {
  roleId: string;
  name: string;
  description: string;
  maxParticipants: number;
  capacityRemaining: number;
}

interface PublicEventData {
  title: string;
  purpose?: string;
  agenda?: string;
  start: string;
  end: string;
  location: string;
  flyerUrl?: string;
  roles: PublicEventRole[];
  slug: string;
}

export default function PublicEvent() {
  const { slug } = useParams();
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
          if (active) setData(eventData as PublicEventData);
        } catch (err: any) {
          if (err.message.includes("404")) {
            throw new Error("This event is not published or does not exist.");
          }
          throw err;
        }
      } catch (e: any) {
        if (active) setError(e.message || "Failed to load event");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [slug]);

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

  const startDate = new Date(data.start);
  const endDate = new Date(data.end);

  const dateRange =
    startDate.toDateString() === endDate.toDateString()
      ? startDate.toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        }) +
        " - " +
        endDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : startDate.toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        }) +
        " → " +
        endDate.toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        });

  return (
    <div className="max-w-3xl mx-auto p-6" data-testid="public-event-page">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight mb-2">{data.title}</h1>
        <div className="text-sm text-gray-600" data-testid="public-event-dates">
          {dateRange}
        </div>
        <div
          className="text-sm text-gray-600 mt-1"
          data-testid="public-event-location"
        >
          {data.location}
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
          <p className="leading-relaxed whitespace-pre-line">{data.purpose}</p>
        </section>
      )}

      {data.agenda && (
        <section className="mb-6" data-testid="public-event-agenda">
          <h2 className="text-xl font-semibold mb-2">Agenda</h2>
          <p className="leading-relaxed whitespace-pre-line">{data.agenda}</p>
        </section>
      )}

      <section className="mb-8" data-testid="public-event-roles">
        <h2 className="text-xl font-semibold mb-3">Available Roles</h2>
        {data.roles.length === 0 && (
          <p className="text-sm text-gray-500">
            No public roles are available for this event.
          </p>
        )}
        <ul className="space-y-3">
          {data.roles.map((r) => (
            <li key={r.roleId} className="border rounded p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-medium text-lg">{r.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{r.description}</p>
                </div>
                <div className="text-right text-sm">
                  <div className="font-semibold">
                    {r.capacityRemaining}/{r.maxParticipants}
                  </div>
                  <div className="text-gray-500">spots</div>
                </div>
              </div>
              <div className="mt-3">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setRoleId(r.roleId)}
                  className={`px-3 py-1 rounded text-sm font-medium border transition-colors ${
                    roleId === r.roleId
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-indigo-700 border-indigo-300 hover:bg-indigo-50"
                  }`}
                >
                  {roleId === r.roleId ? "Selected" : "Select"}
                </button>
              </div>
            </li>
          ))}
        </ul>
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
                const res: any = await apiClient.registerForPublicEvent(slug, {
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
              } catch (err: any) {
                setResultMsg(err.message || "Registration failed");
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
          <div className="max-w-md p-4 border rounded bg-green-50 text-sm mt-4">
            <p className="font-medium mb-1">{resultMsg}</p>
            {duplicate ? (
              <p className="text-gray-600">
                You were already registered for this role. We've sent another
                confirmation.
              </p>
            ) : (
              <p className="text-gray-600">
                Check your email for a confirmation (and future updates).
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                setResultMsg(null);
                setDuplicate(false);
                setName("");
                setEmail("");
                setPhone("");
              }}
              className="mt-3 text-indigo-600 underline text-xs"
            >
              Register another participant
            </button>
          </div>
        )}
      </section>

      <footer
        className="pt-4 border-t text-xs text-gray-500"
        data-testid="public-event-footer"
      >
        <p>Public event — registration powered by early public endpoint.</p>
      </footer>
    </div>
  );
}
