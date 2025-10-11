import { useEffect, useState, useCallback } from "react";
import { socketService } from "../services/socketService";

interface AvatarUpdateData {
  userId: string;
  type: "role_changed" | "status_changed" | "deleted" | "profile_edited";
  user: {
    id: string;
    role?: string;
    avatar?: string;
    phone?: string;
    isAtCloudLeader?: boolean;
    roleInAtCloud?: string;
    isActive?: boolean;
  };
  changes?: Record<string, boolean>;
  timestamp?: string;
}

/**
 * Hook to listen for real-time avatar updates via WebSocket
 *
 * This hook triggers re-renders when any user's avatar is updated,
 * ensuring avatars are fresh across the app without manual refresh.
 *
 * @param onAvatarUpdate - Optional callback when an avatar update occurs
 * @returns updateCounter that changes when avatars are updated (can be used as dependency)
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const avatarUpdateCounter = useAvatarUpdates();
 *
 *   // This effect will re-run whenever any avatar is updated
 *   useEffect(() => {
 *     fetchData();
 *   }, [avatarUpdateCounter]);
 * }
 * ```
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   useAvatarUpdates((userId, avatarUrl) => {
 *     // Custom logic when avatar updates
 *     console.log(`User ${userId} updated avatar to ${avatarUrl}`);
 *   });
 * }
 * ```
 */
export function useAvatarUpdates(
  onAvatarUpdate?: (userId: string, newAvatarUrl: string | undefined) => void
): number {
  const [updateCounter, setUpdateCounter] = useState(0);

  const handleAvatarUpdate = useCallback(
    (data: AvatarUpdateData) => {
      // Only process profile edits that include avatar changes
      if (data.type === "profile_edited" && data.changes?.avatar) {
        // Increment counter to trigger re-renders in dependent components
        setUpdateCounter((prev) => prev + 1);

        // Call custom callback if provided
        if (onAvatarUpdate) {
          onAvatarUpdate(data.userId, data.user.avatar);
        }
      }
    },
    [onAvatarUpdate]
  );

  useEffect(() => {
    // Register listener for user_update events
    socketService.on("user_update", handleAvatarUpdate);

    return () => {
      // Cleanup listener on unmount
      socketService.off("user_update");
    };
  }, [handleAvatarUpdate]);

  return updateCounter;
}

/**
 * Hook to listen for a specific user's avatar updates
 *
 * @param userId - The user ID to watch for avatar updates
 * @param onUpdate - Optional callback when this user's avatar updates
 * @returns The user's current avatar URL (updates when avatar changes)
 *
 * @example
 * ```tsx
 * function UserAvatar({ userId, initialAvatar }) {
 *   const currentAvatar = useUserAvatarUpdates(userId);
 *
 *   return (
 *     <img src={getAvatarUrlWithCacheBust(currentAvatar || initialAvatar, gender)} />
 *   );
 * }
 * ```
 */
export function useUserAvatarUpdates(
  userId: string,
  onUpdate?: (newAvatarUrl: string | undefined) => void
): string | undefined {
  const [currentAvatar, setCurrentAvatar] = useState<string | undefined>();

  useAvatarUpdates((updatedUserId, newAvatarUrl) => {
    if (updatedUserId === userId) {
      setCurrentAvatar(newAvatarUrl);
      if (onUpdate) {
        onUpdate(newAvatarUrl);
      }
    }
  });

  return currentAvatar;
}
