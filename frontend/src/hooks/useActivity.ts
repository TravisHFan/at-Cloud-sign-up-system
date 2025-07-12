import { useState, useEffect } from "react";
import { activityService } from "../services/activityService";
import type {
  ActivityRecord,
  ActivityFilters,
} from "../services/activityService";
import { useAuth } from "./useAuth";

export function useRecentActivity(limit: number = 4) {
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { currentUser } = useAuth();

  useEffect(() => {
    if (!currentUser) {
      setActivities([]);
      setIsLoading(false);
      return;
    }

    // Initialize mock data on first load
    activityService.initializeMockData(currentUser);

    // Get initial activities
    const initialActivities = activityService.getRecentActivities(
      currentUser.id,
      limit
    );
    setActivities(initialActivities);
    setIsLoading(false);

    // Subscribe to activity updates
    const unsubscribe = activityService.subscribe(() => {
      const userActivities = activityService.getRecentActivities(
        currentUser.id,
        limit
      );
      setActivities(userActivities);
    });

    return unsubscribe;
  }, [currentUser, limit]);

  return {
    activities,
    isLoading,
    refresh: () => {
      if (currentUser) {
        const refreshedActivities = activityService.getRecentActivities(
          currentUser.id,
          limit
        );
        setActivities(refreshedActivities);
      }
    },
  };
}

export function useActivityFilters(filters: ActivityFilters) {
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const filteredActivities = activityService.getActivities(filters);
    setActivities(filteredActivities);
    setIsLoading(false);

    // Subscribe to updates
    const unsubscribe = activityService.subscribe(() => {
      const updatedActivities = activityService.getActivities(filters);
      setActivities(updatedActivities);
    });

    return unsubscribe;
  }, [
    filters.userId,
    filters.types?.join(","), // Convert array to string for stable comparison
    filters.startDate?.getTime(), // Convert date to timestamp
    filters.endDate?.getTime(),
    filters.limit,
    filters.includePublic,
  ]);

  return {
    activities,
    isLoading,
  };
}
