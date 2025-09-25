import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

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

  useEffect(() => {
    let active = true;
    async function load() {
      if (!slug) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/public/events/${slug}`);
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error("This event is not published or does not exist.");
          }
          throw new Error(`Request failed: ${res.status}`);
        }
        const json = await res.json();
        if (active) setData(json.data as PublicEventData);
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
            </li>
          ))}
        </ul>
      </section>

      <footer
        className="pt-4 border-t text-xs text-gray-500"
        data-testid="public-event-footer"
      >
        <p>
          Public event preview • This is an early version of the public event
          page.
        </p>
      </footer>
    </div>
  );
}
