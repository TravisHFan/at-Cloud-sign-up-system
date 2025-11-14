import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { programService, purchaseService } from "../services/api";
import type { EventData } from "../types/event";
import { useAvatarUpdates } from "../hooks/useAvatarUpdates";
import { socketService } from "../services/socketService";
import { useAuth } from "../contexts/AuthContext";
import { useToastReplacement } from "../contexts/NotificationModalContext";
import { ProgramParticipants } from "../components/program/ProgramParticipants";
import ProgramHeader from "../components/ProgramDetail/ProgramHeader";
import DeleteProgramModal from "../components/ProgramDetail/DeleteProgramModal";
import ProgramIntroSection from "../components/ProgramDetail/ProgramIntroSection";
import ProgramMentors from "../components/ProgramDetail/ProgramMentors";
import ProgramEventsList from "../components/ProgramDetail/ProgramEventsList";
import ProgramPricing from "../components/ProgramDetail/ProgramPricing";
import LoadingSpinner from "../components/common/LoadingSpinner";
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
          evts = (await programService.listProgramEvents(id)) as unknown[];
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
        const res = await programService.listProgramEventsPaged(id, {
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
      const result = await programService.deleteProgram(id, {
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

  if (loading) {
    // Standardized dashboard loading: centered, fullscreen, larger spinner
    return <LoadingSpinner size="lg" message="Loading program details..." />;
  }

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
        canEdit={
          hasRole(["Administrator", "Super Admin"]) ||
          (program.mentors?.some(
            (mentor: { userId: string }) => mentor.userId === currentUser?.id
          ) ??
            false)
        }
        canDelete={hasRole(["Administrator", "Super Admin"])}
        canCreateEvent={
          // Admin and Super Admin can always create events
          hasRole(["Administrator", "Super Admin"]) ||
          // Leaders can only create events in programs they have access to
          (hasRole(["Leader"]) && hasAccess === true)
        }
        onDelete={openDelete}
      />

      <ProgramIntroSection
        programId={id!}
        introduction={program.introduction}
        flyerUrl={program.flyerUrl}
        isFree={program.isFree}
        hasAccess={hasAccess}
        accessReason={accessReason}
      />

      {/* Mentors section */}
      <ProgramMentors
        mentors={program.mentors || []}
        currentUserId={currentUser?.id || null}
        currentUserRole={currentUser?.role || null}
        accessReason={accessReason}
      />

      {/* Program Participants (Mentees & Class Representatives) - Only shown for paid programs */}
      {program && !program.isFree && (
        <ProgramParticipants programId={program.id} program={program} />
      )}

      {/* Pricing panel (UI label changed to Tuition; internal naming unchanged) */}
      <ProgramPricing
        isFree={program.isFree}
        fullPriceTicket={program.fullPriceTicket}
        classRepDiscount={program.classRepDiscount}
        earlyBirdDiscount={program.earlyBirdDiscount}
        classRepLimit={program.classRepLimit}
        classRepCount={program.classRepCount}
        earlyBirdDeadline={program.earlyBirdDeadline}
        hasAccess={hasAccess}
        accessReason={accessReason}
        onEnrollClick={() => navigate(`/dashboard/programs/${id}/enroll`)}
        pricing={program.pricing}
      />

      {/* Events in program */}
      <ProgramEventsList
        events={events}
        pageEvents={pageEvents}
        page={page}
        totalPages={totalPages}
        pageInput={pageInput}
        pageHelper={pageHelper}
        announceText={announceText}
        sortDir={sortDir}
        isListLoading={isListLoading}
        serverPaginationEnabled={serverPaginationEnabled}
        serverPageEvents={serverPageEvents}
        onSortChange={setSortDir}
        onPageChange={setPageSafe}
        onPageInputChange={(value) => {
          setPageInput(value);
          // show helper for invalid or out-of-range
          const n = Number(value);
          if (Number.isNaN(n)) {
            setPageHelper("Enter a number between 1 and " + totalPages);
          } else if (n < 1 || n > totalPages) {
            setPageHelper(`Page must be between 1 and ${totalPages}`);
          } else {
            setPageHelper("");
          }
        }}
        onPageInputBlur={() => {
          const n = Number(pageInput);
          if (!Number.isNaN(n)) {
            const clamped = Math.max(1, Math.min(totalPages, n));
            setPageSafe(clamped);
            // If input was previously marked out-of-range or is out-of-range now,
            // announce clamping even if the browser/JSDOM auto-clamped the value.
            const wasOutOfRange =
              n < 1 || n > totalPages || (pageHelper ?? "").length > 0;
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
            setPageHelper("Enter a number between 1 and " + totalPages);
          }
        }}
        onPageInputKeyDown={(e) => {
          if (e.key === "Enter") {
            const n = Number(pageInput);
            if (!Number.isNaN(n)) {
              const clamped = Math.max(1, Math.min(totalPages, n));
              // debounce commit by 300ms
              if (pageDebounceId) window.clearTimeout(pageDebounceId);
              const id = window.setTimeout(() => {
                setPageSafe(clamped);
                const wasOutOfRange =
                  n < 1 || n > totalPages || (pageHelper ?? "").length > 0;
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
              setPageHelper("Enter a number between 1 and " + totalPages);
            }
          }
        }}
        onEventClick={(eventId) => navigate(`/dashboard/event/${eventId}`)}
        getEventStatus={getEventStatus}
      />
    </div>
  );
}
