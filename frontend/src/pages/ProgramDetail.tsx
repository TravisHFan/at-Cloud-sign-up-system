import { useEffect, useMemo, useState } from "react";
import { formatCurrency } from "../utils/currency";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { programService } from "../services/api";
import type { EventData } from "../types/event";

type Program = {
  id: string;
  title: string;
  programType: "EMBA Mentor Circles" | "Effective Communication Workshops";
  hostedBy?: string;
  period?: {
    startYear?: string;
    startMonth?: string;
    endYear?: string;
    endMonth?: string;
  };
  introduction?: string;
  flyerUrl?: string;
  mentors?: Array<{
    userId: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    gender?: "male" | "female";
    avatar?: string;
    roleInAtCloud?: string;
  }>;
  mentorsByCircle?: {
    E?: Array<{
      userId: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      gender?: "male" | "female";
      avatar?: string;
      roleInAtCloud?: string;
    }>;
    M?: Array<{
      userId: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      gender?: "male" | "female";
      avatar?: string;
      roleInAtCloud?: string;
    }>;
    B?: Array<{
      userId: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      gender?: "male" | "female";
      avatar?: string;
      roleInAtCloud?: string;
    }>;
    A?: Array<{
      userId: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      gender?: "male" | "female";
      avatar?: string;
      roleInAtCloud?: string;
    }>;
  };
  pricing?: {
    fullPriceTicket: number;
    classRepDiscount?: number;
    earlyBirdDiscount?: number;
  };
};

export default function ProgramDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [program, setProgram] = useState<Program | null>(null);
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialPage = Math.max(1, Number(searchParams.get("page")) || 1);
  const initialSortDir: "asc" | "desc" =
    (searchParams.get("sort") as "asc" | "desc") === "desc" ? "desc" : "asc";
  const [page, setPage] = useState(initialPage);
  const [limit] = useState(20);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(initialSortDir);
  const serverPaginationEnabled =
    import.meta.env?.VITE_PROGRAM_EVENTS_PAGINATION === "server";
  const [isListLoading, setIsListLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const p = await programService.getById(id);
        let evts: unknown[] = [];
        if (serverPaginationEnabled) {
          const res = await programService.listEventsPaged(id, {
            page: 1,
            limit,
            sort: sortDir === "asc" ? "date:asc" : "date:desc",
          });
          evts = res.items as unknown[];
          // Map once and set server pagination state immediately
          type RawEvent = Partial<EventData> & { id?: string; _id?: string };
          const mapped = (evts as RawEvent[]).map((e) => ({
            id: e.id || e._id,
            title: e.title,
            type: e.type,
            date: e.date,
            endDate: e.endDate,
            time: e.time,
            endTime: e.endTime,
            location: e.location,
            organizer: e.organizer,
            roles: e.roles || [],
            signedUp: e.signedUp || 0,
            totalSlots: e.totalSlots || 0,
            format: e.format,
            createdBy: e.createdBy,
            createdAt: e.createdAt,
          })) as EventData[];
          setServerPageEvents(mapped);
          setServerTotalPages(res.totalPages ?? 1);
        } else {
          evts = (await programService.listEvents(id)) as unknown[];
        }
        if (cancelled) return;
        setProgram(p as Program);
        type RawEvent2 = Partial<EventData> & { id?: string; _id?: string };
        setEvents(
          (evts as RawEvent2[]).map((e) => ({
            id: e.id || e._id,
            title: e.title,
            type: e.type,
            date: e.date,
            endDate: e.endDate,
            time: e.time,
            endTime: e.endTime,
            location: e.location,
            organizer: e.organizer,
            roles: e.roles || [],
            signedUp: e.signedUp || 0,
            totalSlots: e.totalSlots || 0,
            format: e.format,
            createdBy: e.createdBy,
            createdAt: e.createdAt,
          })) as EventData[]
        );
        setPage(1);
      } catch (e) {
        console.error("Failed to load program", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, serverPaginationEnabled, limit, sortDir]);

  // Keep URL query in sync with state (page, sort)
  useEffect(() => {
    setSearchParams({ page: String(page), sort: sortDir }, { replace: true });
  }, [page, sortDir, setSearchParams]);

  // Derived sorted + paged events (client fallback)
  const sortedEvents = useMemo(() => {
    const copy = [...events];
    const valueOf = (e: EventData) => {
      // Attempt to construct comparable timestamp
      const dateStr = e.date || "";
      const timeStr = e.time || "00:00";
      const ts = Date.parse(`${dateStr} ${timeStr}`);
      return isNaN(ts) ? 0 : ts;
    };
    copy.sort((a, b) => {
      const diff = valueOf(a) - valueOf(b);
      return sortDir === "asc" ? diff : -diff;
    });
    return copy;
  }, [events, sortDir]);

  const [serverTotalPages, setServerTotalPages] = useState<number | null>(null);
  const totalPages = useMemo(() => {
    if (serverPaginationEnabled && serverTotalPages != null)
      return serverTotalPages;
    return Math.max(1, Math.ceil(sortedEvents.length / limit));
  }, [serverPaginationEnabled, serverTotalPages, sortedEvents.length, limit]);

  const [serverPageEvents, setServerPageEvents] = useState<EventData[] | null>(
    null
  );
  const pageEvents = useMemo(() => {
    if (serverPaginationEnabled && serverPageEvents) return serverPageEvents;
    const start = (page - 1) * limit;
    return sortedEvents.slice(start, start + limit);
  }, [serverPaginationEnabled, serverPageEvents, sortedEvents, page, limit]);

  // React to page/sort changes when server pagination is enabled
  useEffect(() => {
    if (!id || !serverPaginationEnabled) return;
    let cancelled = false;
    (async () => {
      try {
        setIsListLoading(true);
        const res = await programService.listEventsPaged(id, {
          page,
          limit,
          sort: sortDir === "asc" ? "date:asc" : "date:desc",
        });
        if (cancelled) return;
        const items =
          (res.items as (Partial<EventData> & {
            id?: string;
            _id?: string;
          })[]) || [];
        const mapped: EventData[] = items.map((e) => ({
          id: e.id || e._id,
          title: e.title,
          type: e.type,
          date: e.date,
          endDate: e.endDate,
          time: e.time,
          endTime: e.endTime,
          location: e.location,
          organizer: e.organizer,
          roles: e.roles || [],
          signedUp: e.signedUp || 0,
          totalSlots: e.totalSlots || 0,
          format: e.format,
          createdBy: e.createdBy,
          createdAt: e.createdAt,
        })) as EventData[];
        setServerPageEvents(mapped);
        setServerTotalPages(res.totalPages ?? 1);
      } catch (e) {
        console.error("Failed to fetch paged program events", e);
      } finally {
        if (!cancelled) setIsListLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, serverPaginationEnabled, page, limit, sortDir]);

  const periodText = (p?: Program["period"]) => {
    if (!p) return "";
    const s = [p.startMonth, p.startYear].filter(Boolean).join(" ");
    const e = [p.endMonth, p.endYear].filter(Boolean).join(" ");
    return [s, e].filter(Boolean).join(" – ");
  };

  if (loading)
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );

  if (!program) return <div className="text-center">Program not found.</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {program.title}
            </h1>
            <p className="text-sm text-gray-600 mt-1">{program.programType}</p>
            {program.period && (
              <p className="text-sm text-gray-600 mt-1">
                {periodText(program.period)}
              </p>
            )}
          </div>
        </div>
        {program.introduction && (
          <p className="text-gray-800 leading-relaxed">
            {program.introduction}
          </p>
        )}
      </div>

      {/* Mentors section */}
      {(program.mentors || program.mentorsByCircle) && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Mentors</h2>
          {program.mentors && (
            <ul className="list-disc ml-6 text-gray-800">
              {program.mentors.map((m) => (
                <li key={m.userId}>
                  {[m.firstName, m.lastName].filter(Boolean).join(" ")}
                </li>
              ))}
            </ul>
          )}
          {program.mentorsByCircle && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {(["E", "M", "B", "A"] as const).map((c) => {
                const arr = program.mentorsByCircle?.[c];
                if (!arr || arr.length === 0) return null;
                return (
                  <div key={c} className="bg-gray-50 rounded-md p-4 border">
                    <div className="font-medium mb-2">Circle {c}</div>
                    <ul className="list-disc ml-5 text-gray-800">
                      {arr.map((m) => (
                        <li key={`${c}-${m.userId}`}>
                          {[m.firstName, m.lastName].filter(Boolean).join(" ")}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Pricing panel */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">Pricing</h2>
        {!program.pricing ? (
          <p className="text-gray-700">Pricing is being set up.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <div className="text-sm text-gray-600">Full Price Ticket</div>
                <div className="font-medium">
                  {formatCurrency(program.pricing.fullPriceTicket)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Class Rep Discount</div>
                <div className="font-medium">
                  {formatCurrency(program.pricing.classRepDiscount ?? 0)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Early Bird Discount</div>
                <div className="font-medium">
                  {formatCurrency(program.pricing.earlyBirdDiscount ?? 0)}
                </div>
              </div>
            </div>
            <div className="border-t pt-3">
              <div className="text-sm text-gray-600 mb-2">
                Computed Examples
              </div>
              {(() => {
                const full = program.pricing.fullPriceTicket;
                const rep = program.pricing.classRepDiscount ?? 0;
                const early = program.pricing.earlyBirdDiscount ?? 0;
                const clamp = (n: number) => Math.max(0, n);
                const examples = [
                  { label: "Standard", value: clamp(full) },
                  { label: "Class Rep", value: clamp(full - rep) },
                  { label: "Early Bird", value: clamp(full - early) },
                  {
                    label: "Rep + Early Bird",
                    value: clamp(full - rep - early),
                  },
                ];
                return (
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {examples.map((ex) => (
                      <li
                        key={ex.label}
                        className="flex items-center justify-between bg-gray-50 rounded px-3 py-2"
                      >
                        <span className="text-gray-700">{ex.label}</span>
                        <span className="font-medium">
                          {formatCurrency(ex.value)}
                        </span>
                      </li>
                    ))}
                  </ul>
                );
              })()}
              <p className="text-xs text-gray-500 mt-2" aria-live="polite">
                Discounts are illustrative. Final pricing is validated at
                checkout.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Events in program */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Events</h2>
          {events.length > 0 && (
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-700">
                Sort:
                <select
                  aria-label="Sort events"
                  className="ml-2 border rounded px-2 py-1 text-sm"
                  value={sortDir}
                  onChange={(e) => setSortDir(e.target.value as "asc" | "desc")}
                >
                  <option value="asc">Date asc</option>
                  <option value="desc">Date desc</option>
                </select>
              </label>
              <div className="text-sm text-gray-600" aria-live="polite">
                Page {page} of {totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  aria-label="Previous page"
                  className="px-3 py-1 text-sm border rounded disabled:opacity-50"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  Prev
                </button>
                <button
                  type="button"
                  aria-label="Next page"
                  className="px-3 py-1 text-sm border rounded disabled:opacity-50"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
        {events.length === 0 ? (
          <p className="text-gray-700">No events linked to this program yet.</p>
        ) : (
          <div>
            {serverPaginationEnabled && isListLoading ? (
              <div
                className="flex justify-center items-center py-6"
                aria-live="polite"
              >
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                <span className="sr-only">Loading events…</span>
              </div>
            ) : (
              <ul className="divide-y">
                {pageEvents.map((e) => (
                  <li
                    key={e.id}
                    className="py-3 flex justify-between items-center"
                  >
                    <div>
                      <div className="font-medium text-gray-900">{e.title}</div>
                      <div className="text-sm text-gray-600">{e.type}</div>
                    </div>
                    <button
                      className="text-blue-600 hover:text-blue-800 hover:underline text-sm"
                      onClick={() => navigate(`/dashboard/event/${e.id}`)}
                    >
                      View
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
