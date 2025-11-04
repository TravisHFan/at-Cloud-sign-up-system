import { useEffect, useMemo, useState } from "react";
import { formatCurrency } from "../utils/currency";
import {
  useParams,
  useNavigate,
  useSearchParams,
  Link,
} from "react-router-dom";
import { programService, purchaseService } from "../services/api";
import type { EventData } from "../types/event";
import { getAvatarAlt } from "../utils/avatarUtils";
import { useAvatarUpdates } from "../hooks/useAvatarUpdates";
import { socketService } from "../services/socketService";
import { useAuth } from "../contexts/AuthContext";
import { useToastReplacement } from "../contexts/NotificationModalContext";
import { ProgramParticipants } from "../components/program/ProgramParticipants";
import ProgramHeader from "../components/ProgramDetail/ProgramHeader";
import DeleteProgramModal from "../components/ProgramDetail/DeleteProgramModal";
import type { ProgramType } from "../constants/programTypes";

type Program = {
  id: string;
  title: string;
  programType: ProgramType;
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
  // Free program indicator
  isFree?: boolean;
  // Pricing fields are returned top-level from backend model
  fullPriceTicket?: number;
  classRepDiscount?: number;
  earlyBirdDiscount?: number;
  classRepLimit?: number; // Maximum number of Class Rep slots (0 = unlimited)
  classRepCount?: number; // Current number of Class Rep purchases
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
  const { hasRole, currentUser } = useAuth();
  const notification = useToastReplacement();

  // Listen for real-time avatar updates to refresh mentor avatars
  const avatarUpdateCounter = useAvatarUpdates();

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
  const [showFinalConfirm, setShowFinalConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteCascade, setDeleteCascade] = useState<false | true>(false);

  // Purchase/Access state
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [accessReason, setAccessReason] = useState<
    "admin" | "mentor" | "free" | "purchased" | "not_purchased" | null
  >(null);

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
          evts = (await (programService as any).listEvents(id)) as unknown[];
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
  }, [id, serverPaginationEnabled, limit, sortDir, avatarUpdateCounter]);

  // Check program access
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await purchaseService.checkProgramAccess(id);
        if (cancelled) return;
        setHasAccess(result.hasAccess);
        setAccessReason(result.reason);
      } catch (error) {
        console.error("Failed to check program access:", error);
        if (!cancelled) {
          setHasAccess(false);
          setAccessReason("not_purchased");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Connect to WebSocket for real-time updates
  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (token) {
      socketService.connect(token);
    }
  }, []);

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
        const res = await (programService as any).listEventsPaged(id, {
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
        setServerTotalCount((res as { total?: number }).total ?? null);
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

  const onProceedToFinalConfirm = () => {
    setShowDeleteModal(false);
    setShowFinalConfirm(true);
  };

  const onConfirmDelete = async () => {
    if (!id) return;
    try {
      setIsDeleting(true);
      const result = await (programService as any).remove(id, {
        deleteLinkedEvents: !!deleteCascade,
      });

      // Show success notification with details
      const message = deleteCascade
        ? `Program and all linked events deleted successfully. ${
            result.deletedEvents || 0
          } events removed.`
        : `Program deleted successfully. ${
            result.unlinkedEvents || 0
          } events were unlinked and preserved.`;

      notification.success(message, {
        title: "Program Deleted",
        autoCloseDelay: 4000,
      });
      navigate("/dashboard/programs", { replace: true });
    } catch (e: unknown) {
      console.error("Failed to delete program", e);

      // Show error notification with retry guidance
      const error = e as { message?: string; status?: number };
      const errorMsg = error.message || "An unexpected error occurred";
      const isNetworkError =
        !navigator.onLine ||
        errorMsg.includes("NetworkError") ||
        errorMsg.includes("fetch");

      if (isNetworkError) {
        notification.error(
          "Unable to delete program due to network issues. Please check your connection and try again.",
          {
            title: "Connection Error",
          }
        );
      } else if (error.status === 403) {
        notification.error(
          "You don't have permission to delete this program. Contact an administrator if needed.",
          {
            title: "Permission Denied",
          }
        );
      } else if (error.status === 404) {
        notification.error(
          "This program may have already been deleted. Refreshing the page...",
          {
            title: "Program Not Found",
          }
        );
        setTimeout(() => window.location.reload(), 2000);
      } else {
        notification.error(
          `Failed to delete program: ${errorMsg}. Please try again or contact support if the issue persists.`,
          {
            title: "Deletion Failed",
          }
        );
      }

      // Keep modal open on error so user can retry
      setIsDeleting(false);
      return;
    }

    // Only close modals on success
    setIsDeleting(false);
    setShowFinalConfirm(false);
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setShowFinalConfirm(false);
    setDeleteCascade(false);
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
      <DeleteProgramModal
        isOpen={showDeleteModal}
        showFinalConfirm={showFinalConfirm}
        isDeleting={isDeleting}
        linkedEventsCount={linkedEventsCount}
        deleteCascade={deleteCascade}
        onCascadeChange={setDeleteCascade}
        onProceedToFinalConfirm={onProceedToFinalConfirm}
        onConfirmDelete={onConfirmDelete}
        onCancel={cancelDelete}
      />

      <ProgramHeader
        programId={id!}
        title={program.title}
        programType={program.programType}
        period={program.period}
        canEdit={hasRole(["Administrator", "Super Admin"])}
        canDelete={hasRole(["Administrator", "Super Admin"])}
        onDelete={openDelete}
      />

      {/* Introduction Section */}
      {program.introduction && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Introduction
              </h3>
              <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                {program.introduction}
              </p>

              {/* Enrollment CTA or Thank You Message */}
              {!program.isFree &&
                hasAccess !== null &&
                (hasAccess ? (
                  <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center">
                      <img
                        src="/check.svg"
                        alt="Enrolled"
                        className="w-6 h-6 mr-3"
                      />
                      <div>
                        <p className="font-semibold text-green-900">
                          {accessReason === "admin" || accessReason === "mentor"
                            ? "Congratulations!"
                            : "You're enrolled!"}
                        </p>
                        <p className="text-sm text-green-700 mt-1">
                          {accessReason === "admin"
                            ? "As an administrator, you have full access to all programs."
                            : accessReason === "mentor"
                            ? "As a mentor of this program, you have full access."
                            : "Thank you for enrolling. You now have access to all events in this program."}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-6">
                    <button
                      onClick={() =>
                        navigate(`/dashboard/programs/${id}/enroll`)
                      }
                      className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-8 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
                    >
                      <span>Enroll Now</span>
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

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
      {program.mentors && program.mentors.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Mentors</h2>
          <p className="text-gray-600 text-sm mb-4 italic">
            — Spiritual Guides and Leadership Coaches
            <br />
            Mentors are seasoned ministry & business leaders who model
            Christ-centered leadership and guide others in faith, personal
            growth, and practical skills.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {program.mentors.map((m) => {
              // Use avatar URL directly from database (backend updates it atomically)
              let avatarUrl = m.avatar;

              if (!avatarUrl || avatarUrl.includes("default-avatar")) {
                // Use default avatar based on gender
                const gender =
                  (m.gender as "male" | "female" | undefined) || "male";
                avatarUrl =
                  gender === "male"
                    ? "/default-avatar-male.jpg"
                    : "/default-avatar-female.jpg";
              }

              // Check if current user can see mentor contact info
              // Visible to: Admins, Mentees, and Class Reps
              const isAdmin =
                currentUser?.role === "Super Admin" ||
                currentUser?.role === "Administrator";
              const isEnrolled =
                accessReason === "purchased" || accessReason === "free";
              const canViewContact = isAdmin || isEnrolled;

              const isOwnCard = currentUser?.id === m.userId;
              const profileLink = isOwnCard
                ? "/dashboard/profile"
                : `/dashboard/profile/${m.userId}`;

              // Check if user has permission to view other profiles
              const canViewProfiles =
                currentUser?.role === "Super Admin" ||
                currentUser?.role === "Administrator" ||
                currentUser?.role === "Leader";

              const mentorInfoContent = (
                <div className="flex items-start space-x-3 mb-3">
                  <img
                    src={avatarUrl}
                    alt={getAvatarAlt(
                      m.firstName || "",
                      m.lastName || "",
                      !!m.avatar
                    )}
                    className="h-12 w-12 rounded-full object-cover flex-shrink-0"
                  />
                  <div className="flex-1">
                    <div
                      className={`font-medium text-gray-900 ${
                        canViewProfiles
                          ? "hover:text-blue-600 transition-colors"
                          : ""
                      }`}
                    >
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
              );

              return (
                <div
                  key={m.userId}
                  className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                >
                  {canViewProfiles ? (
                    <Link to={profileLink} className="block">
                      {mentorInfoContent}
                    </Link>
                  ) : (
                    mentorInfoContent
                  )}
                  {canViewContact && m.email && (
                    <div className="space-y-1">
                      <div className="flex items-center text-sm text-gray-600">
                        <img
                          src="/mail.svg"
                          alt="Mail icon"
                          className="w-3.5 h-3.5 mr-3"
                        />
                        <a
                          href={`mailto:${m.email}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {m.email}
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Program Participants (Mentees & Class Representatives) - Only shown for paid programs */}
      {program && !program.isFree && (
        <ProgramParticipants programId={program.id} program={program} />
      )}

      {/* Pricing panel (UI label changed to Tuition; internal naming unchanged) */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">Tuition</h2>
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
              return <p className="text-gray-700">Tuition is being set up.</p>;
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
                    {/* Class Rep Slot Availability */}
                    {program.classRepLimit !== undefined &&
                      program.classRepLimit > 0 && (
                        <div className="mt-1 text-xs text-gray-600 bg-purple-50 px-2 py-1 rounded border border-purple-200 max-w-fit">
                          <span className="inline-flex items-center">
                            <svg
                              className="w-3 h-3 mr-1 text-purple-600"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                            </svg>
                            Slots: {program.classRepCount ?? 0} /{" "}
                            {program.classRepLimit}
                            {program.classRepCount !== undefined &&
                              program.classRepCount >=
                                program.classRepLimit && (
                                <span className="ml-1 text-red-600 font-medium">
                                  (Full)
                                </span>
                              )}
                          </span>
                        </div>
                      )}
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">
                      Early Bird Discount
                    </div>
                    <div className="font-medium">
                      {formatCurrency(early ?? 0)}
                    </div>
                    {program.earlyBirdDeadline && (early ?? 0) > 0 && (
                      <div className="mt-1 text-xs text-gray-500 bg-amber-50 px-2 py-1 rounded border border-amber-200 max-w-fit">
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
                    Discounts are illustrative. Final tuition is validated at
                    checkout.
                  </p>
                </div>

                {/* Enrollment CTA or Thank You Message - same as in Introduction */}
                {hasAccess !== null &&
                  (hasAccess ? (
                    <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center">
                        <img
                          src="/check.svg"
                          alt="Enrolled"
                          className="w-6 h-6 mr-3"
                        />
                        <div>
                          <p className="font-semibold text-green-900">
                            {accessReason === "admin" ||
                            accessReason === "mentor"
                              ? "Congratulations!"
                              : "You're enrolled!"}
                          </p>
                          <p className="text-sm text-green-700 mt-1">
                            {accessReason === "admin"
                              ? "As an administrator, you have full access to all programs."
                              : accessReason === "mentor"
                              ? "As a mentor of this program, you have full access."
                              : "Thank you for enrolling. You now have access to all events in this program."}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-6">
                      <button
                        onClick={() =>
                          navigate(`/dashboard/programs/${id}/enroll`)
                        }
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-8 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
                      >
                        <span>Enroll Now</span>
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </button>
                    </div>
                  ))}
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
