import { useState, useEffect, useCallback } from "react";
import { analyticsService, searchService } from "../services/api";
import toast from "react-hot-toast";

// Hook for comprehensive analytics from backend
export function useAnalyticsData() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [userAnalytics, setUserAnalytics] = useState<any>(null);
  const [eventAnalytics, setEventAnalytics] = useState<any>(null);
  const [engagementAnalytics, setEngagementAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);

  const fetchAllAnalytics = useCallback(async () => {
    // Prevent excessive requests - minimum 30 seconds between fetches
    const now = Date.now();
    if (now - lastFetchTime < 30000) {
      return;
    }

    setLoading(true);
    setError(null);
    setLastFetchTime(now);

    try {
      const [generalResponse, userResponse, eventResponse, engagementResponse] =
        await Promise.all([
          analyticsService.getAnalytics(),
          analyticsService.getUserAnalytics(),
          analyticsService.getEventAnalytics(),
          analyticsService.getEngagementAnalytics(),
        ]);

      setAnalytics(generalResponse);
      setUserAnalytics(userResponse);
      setEventAnalytics(eventResponse);
      setEngagementAnalytics(engagementResponse);
    } catch (err: any) {
      const errorMessage = err.message || "Failed to load analytics";
      setError(errorMessage);
      toast.error(errorMessage);
      console.error("Error fetching analytics:", err);
    } finally {
      setLoading(false);
    }
  }, [lastFetchTime]);

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
        toast.success("Analytics exported successfully");
      } catch (err: any) {
        const errorMessage = err.message || "Failed to export analytics";
        toast.error(errorMessage);
        console.error("Error exporting analytics:", err);
      }
    },
    []
  );

  useEffect(() => {
    fetchAllAnalytics();
  }, [fetchAllAnalytics]);

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
  const [searchResults, setSearchResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchUsers = useCallback(async (query: string, filters?: any) => {
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const results = await searchService.searchUsers(query, filters);
      setSearchResults(results);
    } catch (err: any) {
      const errorMessage = err.message || "Failed to search users";
      setError(errorMessage);
      console.error("❌ Error searching users:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const searchEvents = useCallback(async (query: string, filters?: any) => {
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const results = await searchService.searchEvents(query, filters);
      setSearchResults(results);
    } catch (err: any) {
      const errorMessage = err.message || "Failed to search events";
      setError(errorMessage);
      console.error("Error searching events:", err);
    } finally {
      setLoading(false);
    }
  }, []);

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
    } catch (err: any) {
      const errorMessage = err.message || "Failed to perform global search";
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
