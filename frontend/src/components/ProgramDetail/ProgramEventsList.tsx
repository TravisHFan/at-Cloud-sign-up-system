import type { EventData } from "../../types/event";

interface ProgramEventsListProps {
  // Event data
  events: EventData[];
  pageEvents: EventData[];

  // Pagination state
  page: number;
  totalPages: number;
  pageInput: string;
  pageHelper: string;
  announceText: string;

  // Sort state
  sortDir: "asc" | "desc";

  // Loading/display state
  isListLoading: boolean;
  serverPaginationEnabled: boolean;
  serverPageEvents: EventData[] | null;

  // Event handlers
  onSortChange: (dir: "asc" | "desc") => void;
  onPageChange: (page: number) => void;
  onPageInputChange: (value: string) => void;
  onPageInputBlur: () => void;
  onPageInputKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onEventClick: (eventId: string) => void;

  // Status helper
  getEventStatus: (event: EventData) => "upcoming" | "past" | "ongoing";
}

const StatusBadge = ({
  status,
}: {
  status: "upcoming" | "past" | "ongoing";
}) => {
  const style =
    status === "upcoming"
      ? "bg-green-100 text-green-800 border-green-200"
      : status === "ongoing"
      ? "bg-yellow-100 text-yellow-800 border-yellow-200"
      : "bg-gray-100 text-gray-800 border-gray-200"; // past
  const text =
    status === "past" ? "Past" : status === "ongoing" ? "Ongoing" : "Upcoming";
  return (
    <span
      className={`ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${style}`}
      aria-label={`Event status: ${text}`}
    >
      {text}
    </span>
  );
};

export default function ProgramEventsList({
  events,
  pageEvents,
  page,
  totalPages,
  pageInput,
  pageHelper,
  announceText,
  sortDir,
  isListLoading,
  serverPaginationEnabled,
  serverPageEvents,
  onSortChange,
  onPageChange,
  onPageInputChange,
  onPageInputBlur,
  onPageInputKeyDown,
  onEventClick,
  getEventStatus,
}: ProgramEventsListProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Events</h2>
        {(serverPaginationEnabled || events.length > 0) && (
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-700">
              Sort:
              <select
                aria-label="Sort events"
                className="ml-2 border rounded px-2 py-1 text-sm"
                value={sortDir}
                onChange={(e) => onSortChange(e.target.value as "asc" | "desc")}
              >
                <option value="asc">Date asc</option>
                <option value="desc">Date desc</option>
              </select>
            </label>
            <span className="sr-only" aria-live="polite">
              {announceText}
            </span>
            <label className="text-sm text-gray-700 flex items-center gap-2">
              <span className="whitespace-nowrap">Go to page</span>
              <input
                aria-label="Go to page"
                type="text"
                inputMode="numeric"
                min={1}
                max={totalPages}
                className="w-20 border rounded px-2 py-1 text-sm"
                value={pageInput}
                onChange={(e) => onPageInputChange(e.target.value)}
                onBlur={onPageInputBlur}
                onKeyDown={onPageInputKeyDown}
              />
            </label>
            {pageHelper && (
              <div className="text-xs text-red-600" role="note">
                {pageHelper}
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  aria-label="Previous page"
                  className="px-3 py-1 text-sm border rounded disabled:opacity-50"
                  onClick={() => onPageChange(page - 1)}
                  disabled={page <= 1}
                >
                  Prev
                </button>
                <button
                  type="button"
                  aria-label="Next page"
                  className="px-3 py-1 text-sm border rounded disabled:opacity-50"
                  onClick={() => onPageChange(page + 1)}
                  disabled={page >= totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      {serverPaginationEnabled ? (
        <div>
          {isListLoading ? (
            <div
              className="flex justify-center items-center gap-2 py-6"
              role="status"
              aria-live="polite"
            >
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              <span>Loading events…</span>
            </div>
          ) : serverPageEvents && serverPageEvents.length > 0 ? (
            <ul className="divide-y">
              {pageEvents.map((e) => (
                <li
                  key={e.id}
                  className="py-3 flex justify-between items-center"
                >
                  <div>
                    <div className="font-medium text-gray-900 flex items-center">
                      <span>{e.title}</span>
                      <StatusBadge status={getEventStatus(e)} />
                    </div>
                    <div className="text-sm text-gray-600">{e.type}</div>
                  </div>
                  <button
                    className="text-blue-600 hover:text-blue-800 hover:underline text-sm"
                    onClick={() => onEventClick(e.id!)}
                  >
                    View
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-700">
              No events linked to this program yet.
            </p>
          )}
        </div>
      ) : events.length === 0 ? (
        <p className="text-gray-700">No events linked to this program yet.</p>
      ) : (
        <div>
          <ul className="divide-y">
            {pageEvents.map((e) => (
              <li key={e.id} className="py-3 flex justify-between items-center">
                <div>
                  <div className="font-medium text-gray-900 flex items-center">
                    <span>{e.title}</span>
                    <StatusBadge status={getEventStatus(e)} />
                  </div>
                  <div className="text-sm text-gray-600">{e.type}</div>
                </div>
                <button
                  className="text-blue-600 hover:text-blue-800 hover:underline text-sm"
                  onClick={() => onEventClick(e.id!)}
                >
                  View
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
