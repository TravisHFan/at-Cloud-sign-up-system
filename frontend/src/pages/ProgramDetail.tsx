import { useEffect, useMemo, useState } from "react";
import { formatCurrency } from "../utils/currency";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { programService } from "../services/api";
import type { EventData } from "../types/event";
import { getAvatarUrl, getAvatarAlt } from "../utils/avatarUtils";
import { PlusIcon } from "@heroicons/react/24/outline";
import EditButton from "../components/common/EditButton";
import { useAuth } from "../contexts/AuthContext";

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
  earlyBirdDeadline?: string;
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
  // Free program indicator
  isFree?: boolean;
  // Pricing fields are returned top-level from backend model
  fullPriceTicket?: number;
  classRepDiscount?: number;
  earlyBirdDiscount?: number;
  // Optional legacy/nested shape for compatibility with older tests/data
  pricing?: {
    fullPriceTicket?: number;
    classRepDiscount?: number;
    earlyBirdDiscount?: number;
  };
};

export default function ProgramDetail({
  forceServerPagination,
}: { forceServerPagination?: boolean } = {}) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
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
  const [pageInput, setPageInput] = useState<string>(String(initialPage));
  const [announceText, setAnnounceText] = useState<string>("");
  const [pageHelper, setPageHelper] = useState<string>("");
  const [pageDebounceId, setPageDebounceId] = useState<number | null>(null);
  // Prefer explicit prop (tests) then env flag
  const serverPaginationEnabled =
    forceServerPagination !== undefined
      ? !!forceServerPagination
      : import.meta.env?.VITE_PROGRAM_EVENTS_PAGINATION === "server";
  const [isListLoading, setIsListLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteCascade, setDeleteCascade] = useState<false | true>(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const p = await programService.getById(id);
        let evts: unknown[] = [];
        if (!serverPaginationEnabled) {
          // Client-side mode: fetch all events once here
          evts = (await programService.listEvents(id)) as unknown[];
        }
        if (cancelled) return;
        setProgram(p as Program);
        type RawEvent2 = Partial<EventData> & { id?: string; _id?: string };
        if (!serverPaginationEnabled) {
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
        }
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
    // keep input in sync with actual page
    setPageInput(String(page));
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
  const [serverTotalCount, setServerTotalCount] = useState<number | null>(null);
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

  // Helper for numeric page jumps (keeps URL in sync via useEffect above)
  const setPageSafe = (n: number) => {
    const clamped = Math.max(1, Math.min(totalPages, n));
    if (serverPaginationEnabled) {
      // Proactively show spinner on page transitions in server mode
      setIsListLoading(true);
    }
    setPage(clamped);
  };

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
        setServerTotalCount((res as any).total ?? null);
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

  // Determine status label (upcoming/past/ongoing) using event dates/times.
  const getEventStatus = (e: EventData): "upcoming" | "past" | "ongoing" => {
    // Prefer backend-provided status if available and valid
    if (
      e.status === "upcoming" ||
      e.status === "ongoing" ||
      e.status === "completed"
    ) {
      // Map completed -> past for user-facing label consistency here
      return e.status === "completed"
        ? "past"
        : (e.status as "upcoming" | "ongoing");
    }
    const startTs = Date.parse(`${e.date || ""} ${e.time || "00:00"}`);
    const endTs = Date.parse(
      `${e.endDate || e.date || ""} ${e.endTime || e.time || "23:59"}`
    );
    const now = Date.now();
    if (!isNaN(startTs) && !isNaN(endTs)) {
      if (now < startTs) return "upcoming";
      if (now > endTs) return "past";
      return "ongoing";
    }
    if (!isNaN(startTs)) return now < startTs ? "upcoming" : "past";
    // If no parseable date, default to upcoming (neutral)
    return "upcoming";
  };

  const StatusBadge = ({
    status,
  }: {
    status: ReturnType<typeof getEventStatus>;
  }) => {
    const style =
      status === "upcoming"
        ? "bg-green-100 text-green-800 border-green-200"
        : status === "ongoing"
        ? "bg-yellow-100 text-yellow-800 border-yellow-200"
        : "bg-gray-100 text-gray-800 border-gray-200"; // past
    const text =
      status === "past"
        ? "Past"
        : status === "ongoing"
        ? "Ongoing"
        : "Upcoming";
    return (
      <span
        className={`ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${style}`}
        aria-label={`Event status: ${text}`}
      >
        {text}
      </span>
    );
  };

  // Linked events count for delete dialog
  const linkedEventsCount = useMemo(() => {
    if (!id) return 0;
    if (serverPaginationEnabled) {
      return serverTotalCount ?? serverPageEvents?.length ?? 0;
    }
    return events.length;
  }, [
    id,
    serverPaginationEnabled,
    serverTotalCount,
    serverPageEvents,
    events.length,
  ]);

  const openDelete = () => {
    setDeleteCascade(false);
    setShowDeleteModal(true);
  };

  const onConfirmDelete = async () => {
    if (!id) return;
    try {
      setIsDeleting(true);
      await programService.remove(id, { deleteLinkedEvents: !!deleteCascade });
      navigate("/dashboard/programs", { replace: true });
    } catch (e) {
      console.error("Failed to delete program", e);
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const periodText = (p?: Program["period"]) => {
    if (!p) return "";
    const monthCodeToName: Record<string, string> = {
      "01": "January",
      "02": "February",
      "03": "March",
      "04": "April",
      "05": "May",
      "06": "June",
      "07": "July",
      "08": "August",
      "09": "September",
      "10": "October",
      "11": "November",
      "12": "December",
    };
    const normalize = (m?: string) =>
      m && monthCodeToName[m] ? monthCodeToName[m] : m;
    const s = [normalize(p.startMonth), p.startYear].filter(Boolean).join(" ");
    const e = [normalize(p.endMonth), p.endYear].filter(Boolean).join(" ");
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
    <div className="max-w-5xl mx-auto space-y-6 min-h-full">
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="program-delete-title"
            className="relative bg-white rounded-lg shadow-xl w-full max-w-lg mx-4"
          >
            <div className="p-6">
              <h2
                id="program-delete-title"
                className="text-xl font-semibold text-gray-900"
              >
                Delete Program
              </h2>
              <p className="mt-2 text-sm text-gray-700">
                This action cannot be undone. Choose how to handle the program's
                linked events.
              </p>
              <div className="mt-4 space-y-3">
                <label className="flex items-start gap-3 p-3 border rounded-md hover:bg-gray-50 cursor-pointer">
                  <input
                    type="radio"
                    name="delete-mode"
                    checked={!deleteCascade}
                    onChange={() => setDeleteCascade(false)}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium text-gray-900">
                      Delete program only
                    </div>
                    <div className="text-sm text-gray-600">
                      Keep {linkedEventsCount} linked{" "}
                      {linkedEventsCount === 1 ? "event" : "events"} and unlink
                      them from this program.
                    </div>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-3 border rounded-md hover:bg-gray-50 cursor-pointer">
                  <input
                    type="radio"
                    name="delete-mode"
                    checked={!!deleteCascade}
                    onChange={() => setDeleteCascade(true)}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium text-gray-900">
                      Delete program and all linked events
                    </div>
                    <div className="text-sm text-gray-600">
                      Permanently remove this program and its{" "}
                      {linkedEventsCount} linked{" "}
                      {linkedEventsCount === 1 ? "event" : "events"}.
                    </div>
                  </div>
                </label>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 rounded-md border text-gray-700 hover:bg-gray-50"
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  onClick={onConfirmDelete}
                  className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                  disabled={isDeleting}
                >
                  {isDeleting
                    ? "Deleting..."
                    : deleteCascade
                    ? "Delete Program & Events"
                    : "Delete Program"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
          <div className="flex gap-2">
            <EditButton
              onClick={() => navigate(`/dashboard/programs/${id}/edit`)}
            />
            {hasRole("Administrator") && (
              <button
                onClick={openDelete}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Delete Program
              </button>
            )}
            <button
              onClick={() =>
                navigate(`/dashboard/event-config?programId=${id}`)
              }
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <PlusIcon className="h-4 w-4 mr-1.5" />
              Create New Event
            </button>
          </div>
        </div>
        {program.introduction && (
          <p className="text-gray-800 leading-relaxed whitespace-pre-line">
            {program.introduction}
          </p>
        )}
      </div>

      {/* Program Flyer (optional) */}
      {program.flyerUrl && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Program Flyer
          </h2>
          <div className="flex">
            <img
              src={program.flyerUrl}
              alt="Program flyer"
              className="w-full max-w-2xl h-auto rounded border border-gray-200 object-contain"
            />
          </div>
        </div>
      )}

      {/* Mentors section */}
      {(program.mentors || program.mentorsByCircle) && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Mentors</h2>
          {program.mentors && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {program.mentors.map((m) => (
                <div
                  key={m.userId}
                  className="bg-gray-50 rounded-lg p-4 border border-gray-200 flex items-start space-x-3"
                >
                  <img
                    src={getAvatarUrl(
                      m.avatar || null,
                      (m.gender as "male" | "female" | undefined) || "male"
                    )}
                    alt={getAvatarAlt(
                      m.firstName || "",
                      m.lastName || "",
                      !!m.avatar
                    )}
                    className="h-12 w-12 rounded-full object-cover flex-shrink-0"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">
                      {[m.firstName, m.lastName].filter(Boolean).join(" ") ||
                        "Mentor"}
                    </div>
                    {m.roleInAtCloud && (
                      <div className="text-sm text-gray-600">
                        {m.roleInAtCloud}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {program.mentorsByCircle && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {(["E", "M", "B", "A"] as const).map((c) => {
                const arr = program.mentorsByCircle?.[c];
                if (!arr || arr.length === 0) return null;
                return (
                  <div
                    key={c}
                    className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                  >
                    <div className="font-semibold text-gray-900 mb-4">
                      Circle {c}
                    </div>
                    <div className="space-y-3">
                      {arr.map((m) => (
                        <div
                          key={`${c}-${m.userId}`}
                          className="flex items-start space-x-3"
                        >
                          <img
                            src={getAvatarUrl(
                              m.avatar || null,
                              (m.gender as "male" | "female" | undefined) ||
                                "male"
                            )}
                            alt={getAvatarAlt(
                              m.firstName || "",
                              m.lastName || "",
                              !!m.avatar
                            )}
                            className="h-10 w-10 rounded-full object-cover flex-shrink-0"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">
                              {[m.firstName, m.lastName]
                                .filter(Boolean)
                                .join(" ") || "Mentor"}
                            </div>
                            {m.roleInAtCloud && (
                              <div className="text-sm text-gray-600">
                                {m.roleInAtCloud}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
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
        {program.isFree ? (
          <div className="text-center py-8">
            <div className="inline-flex items-center px-4 py-2 bg-green-50 border border-green-200 rounded-lg">
              <svg
                className="w-5 h-5 text-green-500 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-lg font-medium text-green-800">
                This is a free program
              </span>
            </div>
          </div>
        ) : (
          (() => {
            const full =
              program.fullPriceTicket ?? program.pricing?.fullPriceTicket;
            const rep =
              program.classRepDiscount ?? program.pricing?.classRepDiscount;
            const early =
              program.earlyBirdDiscount ?? program.pricing?.earlyBirdDiscount;
            if (full == null) {
              return <p className="text-gray-700">Pricing is being set up.</p>;
            }
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <div className="text-sm text-gray-600">
                      Full Price Ticket
                    </div>
                    <div className="font-medium">
                      {formatCurrency(full || 0)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">
                      Class Rep Discount
                    </div>
                    <div className="font-medium">
                      {formatCurrency(rep ?? 0)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">
                      Early Bird Discount
                    </div>
                    <div className="font-medium">
                      {formatCurrency(early ?? 0)}
                    </div>
                    {program.earlyBirdDeadline && (early ?? 0) > 0 && (
                      <div className="mt-1 text-xs text-gray-500 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                        <span className="inline-flex items-center">
                          <svg
                            className="w-3 h-3 mr-1 text-amber-600"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                              clipRule="evenodd"
                            />
                          </svg>
                          Valid until {program.earlyBirdDeadline.split("T")[0]}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                {/* Early Bird deadline note is now grouped under the Early Bird Discount amount */}
                <div className="border-t pt-3">
                  <div className="text-sm text-gray-600 mb-2">
                    Computed Examples
                  </div>
                  {(() => {
                    const f = full || 0;
                    const r = rep ?? 0;
                    const e = early ?? 0;
                    const clamp = (n: number) => Math.max(0, n);
                    const examples = [
                      { label: "Standard", value: clamp(f) },
                      { label: "Class Rep", value: clamp(f - r) },
                      { label: "Early Bird", value: clamp(f - e) },
                      { label: "Rep + Early Bird", value: clamp(f - r - e) },
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
            );
          })()
        )}
      </div>

      {/* Events in program */}
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
                  onChange={(e) => setSortDir(e.target.value as "asc" | "desc")}
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
                  onChange={(e) => {
                    setPageInput(e.target.value);
                    // show helper for invalid or out-of-range
                    const n = Number(e.target.value);
                    if (Number.isNaN(n)) {
                      setPageHelper(
                        "Enter a number between 1 and " + totalPages
                      );
                    } else if (n < 1 || n > totalPages) {
                      setPageHelper(`Page must be between 1 and ${totalPages}`);
                    } else {
                      setPageHelper("");
                    }
                  }}
                  onBlur={() => {
                    const n = Number(pageInput);
                    if (!Number.isNaN(n)) {
                      const clamped = Math.max(1, Math.min(totalPages, n));
                      setPageSafe(clamped);
                      // If input was previously marked out-of-range or is out-of-range now,
                      // announce clamping even if the browser/JSDOM auto-clamped the value.
                      const wasOutOfRange =
                        n < 1 ||
                        n > totalPages ||
                        (pageHelper ?? "").length > 0;
                      setAnnounceText(
                        wasOutOfRange || clamped !== n
                          ? `Clamped to page ${clamped} of ${totalPages}`
                          : `Moved to page ${clamped} of ${totalPages}`
                      );
                      setPageHelper("");
                    } else {
                      setPageInput(String(page));
                      setAnnounceText(
                        `Invalid page. Staying on page ${page} of ${totalPages}`
                      );
                      setPageHelper(
                        "Enter a number between 1 and " + totalPages
                      );
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const n = Number(pageInput);
                      if (!Number.isNaN(n)) {
                        const clamped = Math.max(1, Math.min(totalPages, n));
                        // debounce commit by 300ms
                        if (pageDebounceId) window.clearTimeout(pageDebounceId);
                        const id = window.setTimeout(() => {
                          setPageSafe(clamped);
                          const wasOutOfRange =
                            n < 1 ||
                            n > totalPages ||
                            (pageHelper ?? "").length > 0;
                          setAnnounceText(
                            wasOutOfRange || clamped !== n
                              ? `Clamped to page ${clamped} of ${totalPages}`
                              : `Moved to page ${clamped} of ${totalPages}`
                          );
                          setPageHelper("");
                        }, 300);
                        setPageDebounceId(id);
                      } else {
                        setPageInput(String(page));
                        setAnnounceText(
                          `Invalid page. Staying on page ${page} of ${totalPages}`
                        );
                        setPageHelper(
                          "Enter a number between 1 and " + totalPages
                        );
                      }
                    }
                  }}
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
                    onClick={() => setPageSafe(page - 1)}
                    disabled={page <= 1}
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    aria-label="Next page"
                    className="px-3 py-1 text-sm border rounded disabled:opacity-50"
                    onClick={() => setPageSafe(page + 1)}
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
                      onClick={() => navigate(`/dashboard/event/${e.id}`)}
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
                    onClick={() => navigate(`/dashboard/event/${e.id}`)}
                  >
                    View
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
