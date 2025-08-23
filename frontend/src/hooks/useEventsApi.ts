import { useState, useEffect, useCallback } from "react";
import { eventService } from "../services/api";
import type { EventData } from "../types/event";
import { useToastReplacement } from "../contexts/NotificationModalContext";

export interface UseEventsReturn {
  events: EventData[];
  loading: boolean;
  error: string | null;
  pagination: {
    currentPage: number;
    totalPages: number;
    totalEvents: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  refreshEvents: () => Promise<void>;
  loadPage: (page: number) => Promise<void>;
  searchEvents: (searchTerm: string) => Promise<void>;
  filterEvents: (filters: { status?: string; type?: string }) => Promise<void>;
}

interface UseEventsParams {
  initialPage?: number;
  pageSize?: number;
  autoLoad?: boolean;
  status?: "upcoming" | "completed" | "cancelled";
}

export function useEvents({
  initialPage = 1,
  pageSize = 10,
  autoLoad = true,
  status = "upcoming",
}: UseEventsParams = {}): UseEventsReturn {
  const notification = useToastReplacement();
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 0,
    totalEvents: 0,
    hasNext: false,
    hasPrev: false,
  });
  const [currentFilters, setCurrentFilters] = useState<any>({
    status,
    page: initialPage,
    limit: pageSize,
  });

  const fetchEvents = useCallback(
    async (params: any = {}) => {
      setLoading(true);
      setError(null);

      try {
        const filters = { ...currentFilters, ...params };
        const response = await eventService.getEvents(filters);

        // Convert backend event format to frontend EventData format
        const convertedEvents: EventData[] = response.events.map(
          (event: any) => ({
            id: event.id,
            title: event.title,
            type: event.type,
            date: event.date,
            time: event.time,
            endTime: event.endTime,
            location: event.location,
            organizer: event.organizer,
            hostedBy: event.hostedBy,
            organizerDetails: event.organizerDetails || [],
            purpose: event.purpose,
            agenda: event.agenda,
            format: event.format,
            disclaimer: event.disclaimer,
            roles: event.roles.map((role: any) => ({
              id: role.id,
              name: role.name,
              description: role.description,
              maxParticipants: role.maxParticipants,
              currentSignups: role.currentSignups || [],
            })),
            // Calculate legacy properties for backward compatibility
            signedUp:
              event.roles?.reduce(
                (total: number, role: any) =>
                  total + (role.currentSignups?.length || 0),
                0
              ) || 0,
            totalSlots:
              event.roles?.reduce(
                (total: number, role: any) =>
                  total + (role.maxParticipants || 0),
                0
              ) || 0,
            createdBy: event.createdBy || event.organizer,
            createdAt: event.createdAt,
            isHybrid: event.isHybrid,
            zoomLink: event.zoomLink,
            meetingId: event.meetingId,
            passcode: event.passcode,
            requirements: event.requirements,
            materials: event.materials,
            status: event.status,
          })
        );

        setEvents(convertedEvents);
        setPagination(response.pagination);
        setCurrentFilters(filters);
      } catch (err: any) {
        const errorMessage = err.message || "Failed to load events";
        setError(errorMessage);
        notification.error(errorMessage, {
          title: "Events Load Failed",
        });
        console.error("Error fetching events:", err);
      } finally {
        setLoading(false);
      }
    },
    [] // Remove currentFilters dependency to prevent infinite loop
  );

  const refreshEvents = useCallback(async () => {
    await fetchEvents();
  }, [fetchEvents]);

  const loadPage = useCallback(
    async (page: number) => {
      await fetchEvents({ page });
    },
    [fetchEvents]
  );

  const searchEvents = useCallback(
    async (searchTerm: string) => {
      await fetchEvents({ search: searchTerm, page: 1 });
    },
    [fetchEvents]
  );

  const filterEvents = useCallback(
    async (filters: { status?: string; type?: string }) => {
      await fetchEvents({ ...filters, page: 1 });
    },
    [fetchEvents]
  );

  // Auto-load events on mount - only run once
  useEffect(() => {
    if (autoLoad) {
      fetchEvents();
    }
  }, [autoLoad]); // Remove fetchEvents dependency to prevent infinite loop

  return {
    events,
    loading,
    error,
    pagination,
    refreshEvents,
    loadPage,
    searchEvents,
    filterEvents,
  };
}

// Hook for getting a specific event
export function useEvent(eventId: string) {
  const notification = useToastReplacement();
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEvent = useCallback(async () => {
    if (!eventId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await eventService.getEvent(eventId);

      // Convert backend event format to frontend EventData format
      const convertedEvent: EventData = {
        id: response.id,
        title: response.title,
        type: response.type,
        date: response.date,
        time: response.time,
        endTime: response.endTime,
        location: response.location,
        organizer: response.organizer,
        hostedBy: response.hostedBy,
        organizerDetails: response.organizerDetails || [],
        purpose: response.purpose,
        agenda: response.agenda,
        format: response.format,
        disclaimer: response.disclaimer,
        roles: response.roles.map((role: any) => ({
          id: role.id,
          name: role.name,
          description: role.description,
          maxParticipants: role.maxParticipants,
          currentSignups: role.currentSignups || [],
        })),
        // Calculate legacy properties for backward compatibility
        signedUp:
          response.roles?.reduce(
            (total: number, role: any) =>
              total + (role.currentSignups?.length || 0),
            0
          ) || 0,
        totalSlots:
          response.roles?.reduce(
            (total: number, role: any) => total + (role.maxParticipants || 0),
            0
          ) || 0,
        createdBy: response.createdBy || response.organizer,
        createdAt: response.createdAt,
        isHybrid: response.isHybrid,
        zoomLink: response.zoomLink,
        meetingId: response.meetingId,
        passcode: response.passcode,
        requirements: response.requirements,
        materials: response.materials,
        status: response.status,
      };

      setEvent(convertedEvent);
    } catch (err: any) {
      const errorMessage = err.message || "Failed to load event";
      setError(errorMessage);
      notification.error(errorMessage, {
        title: "Event Load Failed",
      });
      console.error("Error fetching event:", err);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  return {
    event,
    loading,
    error,
    refreshEvent: fetchEvent,
  };
}

// Hook for user's events (registered events)
export function useUserEvents() {
  const [data, setData] = useState<{ events: any[]; stats: any } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUserEvents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await eventService.getUserEvents();

      // The response should now be the data object containing events and stats
      if (
        response &&
        typeof response === "object" &&
        "events" in response &&
        "stats" in response
      ) {
        // New format: object with events and stats at root level
        setData(response as any);
      } else if (Array.isArray(response)) {
        // Old format: direct array (fallback)
        setData({
          events: response,
          stats: { total: 0, upcoming: 0, passed: 0, active: 0, cancelled: 0 },
        });
      } else {
        // Empty or unknown format
        setData({
          events: [],
          stats: { total: 0, upcoming: 0, passed: 0, active: 0, cancelled: 0 },
        });
      }
    } catch (err: any) {
      const errorMessage = err.message || "Failed to load user events";
      setError(errorMessage);
      console.error("Error fetching user events:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserEvents();
  }, [fetchUserEvents]);

  return {
    events: data?.events || [],
    stats: data?.stats || {
      total: 0,
      upcoming: 0,
      passed: 0,
      active: 0,
      cancelled: 0,
    },
    loading,
    error,
    refreshEvents: fetchUserEvents,
  };
}

// Hook for events created by user
export function useCreatedEvents() {
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCreatedEvents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await eventService.getCreatedEvents();

      // Convert to EventData format
      const convertedEvents: EventData[] = response.map((event: any) => ({
        id: event.id || event._id,
        title: event.title,
        type: event.type,
        date: event.date,
        time: event.time,
        endTime: event.endTime,
        location: event.location,
        organizer: event.organizer,
        hostedBy: event.hostedBy,
        organizerDetails: event.organizerDetails || [],
        purpose: event.purpose,
        agenda: event.agenda,
        format: event.format,
        disclaimer: event.disclaimer,
        roles: event.roles || [],
        // Calculate legacy properties for backward compatibility
        signedUp:
          event.roles?.reduce(
            (total: number, role: any) =>
              total + (role.currentSignups?.length || 0),
            0
          ) || 0,
        totalSlots:
          event.roles?.reduce(
            (total: number, role: any) => total + (role.maxParticipants || 0),
            0
          ) || 0,
        createdBy: event.createdBy || event.organizer,
        createdAt: event.createdAt,
        isHybrid: event.isHybrid,
        status: event.status,
      }));

      setEvents(convertedEvents);
    } catch (err: any) {
      const errorMessage = err.message || "Failed to load created events";
      setError(errorMessage);
      console.error("Error fetching created events:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCreatedEvents();
  }, [fetchCreatedEvents]);

  return {
    events,
    loading,
    error,
    refreshEvents: fetchCreatedEvents,
  };
}
