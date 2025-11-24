import { useState, useEffect } from "react";
import { eventsService } from "../services/api/events.api";

export interface EventAccessInfo {
  hasAccess: boolean;
  requiresPurchase: boolean;
  accessReason: string;
}

/**
 * Hook to check event access for paid events feature.
 * Determines if the current user has access to view full event details.
 *
 * Access hierarchy (from backend EventAccessControlService):
 * 1. Event organizer → Always has access
 * 2. Event co-organizer → Always has access
 * 3. Free event → Everyone has access
 * 4. Program purchased → User has access
 * 5. Event purchased → User has access
 * 6. Otherwise → requiresPurchase = true
 *
 * @param eventId - The ID of the event to check access for
 * @returns Object with access info, loading state, and error
 */
export function useEventAccess(eventId: string | undefined) {
  const [accessInfo, setAccessInfo] = useState<EventAccessInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function checkAccess() {
      // Skip if no eventId provided
      if (!eventId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await eventsService.checkEventAccess(eventId);

        if (isMounted) {
          setAccessInfo(result);
        }
      } catch (err) {
        if (isMounted) {
          const errorMessage =
            err instanceof Error ? err.message : "Failed to check event access";
          setError(errorMessage);
          console.error("Error checking event access:", err);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    checkAccess();

    return () => {
      isMounted = false;
    };
  }, [eventId]);

  return {
    /** Whether the user has access to view full event details */
    hasAccess: accessInfo?.hasAccess ?? false,
    /** Whether the user needs to purchase to gain access */
    requiresPurchase: accessInfo?.requiresPurchase ?? false,
    /** Human-readable reason for access decision */
    accessReason: accessInfo?.accessReason ?? "",
    /** Whether the access check is currently loading */
    isLoading,
    /** Error message if access check failed */
    error,
  };
}
