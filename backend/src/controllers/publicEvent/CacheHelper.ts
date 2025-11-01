import { socketService } from "../../services/infrastructure/SocketService";
import { ResponseBuilderService } from "../../services/ResponseBuilderService";
import { CachePatterns } from "../../services";
import { CorrelatedLogger } from "../../services/CorrelatedLogger";

interface RoleSnapshot {
  id: string;
  name: string;
  description?: string;
  openToPublic?: boolean;
  capacity?: number;
}

interface EventData {
  _id: any;
  roles: any[];
}

export class CacheHelper {
  /**
   * Emit real-time socket update & invalidate caches
   * EXACT COPY from lines 512-549
   */
  static async emitRegistrationUpdate(
    event: EventData,
    roleId: string,
    registrationType: "user" | "guest" | null,
    registrationId: string,
    attendeeName?: string,
    log?: CorrelatedLogger
  ): Promise<void> {
    try {
      const eventId = event._id.toString();
      const updatedEvent =
        await ResponseBuilderService.buildEventWithRegistrations(eventId);
      if (registrationType === "guest") {
        socketService.emitEventUpdate(eventId, "guest_registration", {
          eventId,
          roleId,
          guestName: attendeeName,
          event: updatedEvent,
          timestamp: new Date(),
        });
      } else if (registrationType === "user") {
        // Mirror payload contract from eventController user signup path
        const roleSnapshot: RoleSnapshot | undefined = (
          event.roles as unknown as RoleSnapshot[]
        ).find((r) => r.id === roleId);
        socketService.emitEventUpdate(eventId, "user_signed_up", {
          userId: registrationId, // userId not directly tracked here; frontend refetch will reconcile accurate roster
          roleId,
          roleName: roleSnapshot?.name,
          event: updatedEvent,
        });
      }
      await CachePatterns.invalidateEventCache(event._id.toString());
      await CachePatterns.invalidateAnalyticsCache();
    } catch (socketErr) {
      log?.warn(
        "Failed to emit realtime update for public registration",
        undefined,
        {
          error: (socketErr as Error).message,
          eventId: event._id.toString(),
          roleId,
        }
      );
    }
  }
}
