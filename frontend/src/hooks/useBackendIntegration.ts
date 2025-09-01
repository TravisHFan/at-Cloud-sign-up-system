import { useState, useEffect, useCallback, useRef } from "react";
import { analyticsService, searchService } from "../services/api";
import { useToastReplacement } from "../contexts/NotificationModalContext";

// Minimal analytics result shapes (extend as backend stabilizes)
interface GeneralAnalytics {
  upcomingEvents?: unknown[];
  completedEvents?: unknown[];
  [key: string]: unknown;
}

type UserAnalytics = Record<string, unknown>;
type EventAnalytics = Record<string, unknown> & {
  upcomingEvents?: unknown[];
  completedEvents?: unknown[];
};
type EngagementAnalytics = Record<string, unknown>;

// Hook for comprehensive analytics from backend
export function useAnalyticsData(options?: {
  enabled?: boolean;
  suppressAuthErrors?: boolean;
}) {
  const { enabled = true, suppressAuthErrors = false } = options ?? {};
  const notification = useToastReplacement();
  const [analytics, setAnalytics] = useState<GeneralAnalytics | null>(null);
  const [userAnalytics, setUserAnalytics] = useState<UserAnalytics | null>(
    null
  );
  const [eventAnalytics, setEventAnalytics] = useState<EventAnalytics | null>(
    null
  );
  const [engagementAnalytics, setEngagementAnalytics] =
    useState<EngagementAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastFetchTimeRef = useRef<number>(0);

  const fetchAllAnalytics = useCallback(async () => {
    if (!enabled) return; // skip fetching when disabled
    // Prevent excessive requests - minimum 30 seconds between fetches
    const now = Date.now();
    if (now - lastFetchTimeRef.current < 30000) {
      return;
    }

    setLoading(true);
    setError(null);
    lastFetchTimeRef.current = now;

    try {
      const [generalResponse, userResponse, eventResponse, engagementResponse] =
        await Promise.all([
          analyticsService.getAnalytics(),
          analyticsService.getUserAnalytics(),
          analyticsService.getEventAnalytics(),
          analyticsService.getEngagementAnalytics(),
        ]);

      setAnalytics(generalResponse as unknown as GeneralAnalytics);
      setUserAnalytics(userResponse as unknown as UserAnalytics);
      setEventAnalytics(eventResponse as unknown as EventAnalytics);
      setEngagementAnalytics(
        engagementResponse as unknown as EngagementAnalytics
      );
    } catch (err: unknown) {
      const anyErr = err as { message?: string; status?: number } | undefined;
      const errorMessage = anyErr?.message || "Failed to load analytics";
      const status = (anyErr as { status?: number } | undefined)?.status;
      const isAuthError =
        status === 401 ||
        status === 403 ||
        /access\s*denied|permission/i.test(errorMessage);
      setError(errorMessage);
      if (!(suppressAuthErrors && isAuthError)) {
        notification.error(errorMessage);
      } else {
        // Keep console signal low for expected auth denials on restricted pages
        console.warn("Analytics fetch suppressed auth error:", errorMessage);
      }
      console.error("Error fetching analytics:", err);
    } finally {
      setLoading(false);
    }
  }, [enabled, notification, suppressAuthErrors]);

  const exportData = useCallback(
    async (format: "csv" | "xlsx" | "json" = "csv") => {
      try {
        const blob = await analyticsService.exportAnalytics(format);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `analytics-export.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        notification.success("Analytics exported successfully");
      } catch (err: unknown) {
        const errorMessage =
          (err as { message?: string })?.message ||
          "Failed to export analytics";
        notification.error(errorMessage);
        console.error("Error exporting analytics:", err);
      }
    },
    [notification]
  );

  useEffect(() => {
    if (!enabled) return;
    fetchAllAnalytics();
  }, [enabled, fetchAllAnalytics]);

  return {
    analytics,
    userAnalytics,
    eventAnalytics,
    engagementAnalytics,
    loading,
    error,
    refreshAnalytics: fetchAllAnalytics,
    exportData,
  };
}

// Hook for search functionality
export function useSearchApi() {
  const [searchResults, setSearchResults] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  type Primitive = string | number | boolean | null | undefined;
  const searchUsers = useCallback(
    async (query: string, filters?: Record<string, Primitive>) => {
      if (!query.trim()) {
        setSearchResults(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const results = await searchService.searchUsers(query, filters);
        setSearchResults(results);
      } catch (err: unknown) {
        const errorMessage =
          (err as { message?: string })?.message || "Failed to search users";
        setError(errorMessage);
        console.error("❌ Error searching users:", err);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const searchEvents = useCallback(
    async (query: string, filters?: Record<string, Primitive>) => {
      if (!query.trim()) {
        setSearchResults(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const results = await searchService.searchEvents(query, filters);
        setSearchResults(results);
      } catch (err: unknown) {
        const errorMessage =
          (err as { message?: string })?.message || "Failed to search events";
        setError(errorMessage);
        console.error("Error searching events:", err);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const globalSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const results = await searchService.globalSearch(query);
      setSearchResults(results);
    } catch (err: unknown) {
      const errorMessage =
        (err as { message?: string })?.message ||
        "Failed to perform global search";
      setError(errorMessage);
      console.error("Error in global search:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setSearchResults(null);
    setError(null);
  }, []);

  return {
    searchResults,
    loading,
    error,
    searchUsers,
    searchEvents,
    globalSearch,
    clearResults,
  };
}
