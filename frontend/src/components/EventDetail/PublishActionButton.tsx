import { usePublishReadiness } from "../../hooks/usePublishReadiness";
import { useToastReplacement } from "../../contexts/NotificationModalContext";
import type { EventData } from "../../types/event";
import { eventService } from "../../services/api";

interface PublishActionButtonProps {
  event: EventData;
  publishing: boolean;
  setPublishing: (b: boolean) => void;
  setEvent: React.Dispatch<React.SetStateAction<EventData | null>>;
  notification: ReturnType<typeof useToastReplacement>;
  eventService: typeof eventService;
}

function PublishActionButton({
  event,
  publishing,
  setPublishing,
  setEvent,
  notification,
  eventService,
}: PublishActionButtonProps) {
  const { isReady } = usePublishReadiness(event);
  const disabled =
    publishing ||
    (!event.publish && (!isReady || !event.roles.some((r) => r.openToPublic)));
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={async () => {
        if (disabled) return; // guard
        const isPublishingAction = !event.publish;
        try {
          setPublishing(true);
          const updated = isPublishingAction
            ? await eventService.publishEvent(event.id)
            : await eventService.unpublishEvent(event.id);
          const inferredPublish = isPublishingAction
            ? (updated as { publish?: boolean })?.publish ?? true
            : (updated as { publish?: boolean })?.publish ?? false;
          const nextPublishedAt = inferredPublish
            ? (updated as { publishedAt?: string })?.publishedAt ||
              event.publishedAt ||
              new Date().toISOString()
            : event.publishedAt;
          setEvent((prev) => {
            if (!prev)
              return {
                ...(updated as unknown as Record<string, unknown>),
                publish: inferredPublish,
                publishedAt: nextPublishedAt,
                roles: (updated as { roles?: unknown[] })?.roles || [],
              } as unknown as EventData;
            return {
              ...prev,
              publish: inferredPublish,
              publishedAt: nextPublishedAt,
              publicSlug:
                (updated as { publicSlug?: string })?.publicSlug ||
                prev.publicSlug,
            } as EventData;
          });
          notification.success(
            inferredPublish
              ? "Event published publicly."
              : "Event unpublished.",
            { title: inferredPublish ? "Published" : "Unpublished" }
          );
        } catch (e: unknown) {
          notification.error(
            e instanceof Error ? e.message : "Publish action failed",
            { title: "Action Failed" }
          );
        } finally {
          setPublishing(false);
        }
      }}
      className={`px-4 py-2 text-sm font-medium rounded-md shadow-sm border transition-colors disabled:opacity-50 ${
        event.publish
          ? "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
          : "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
      }`}
      title={!event.publish && !isReady ? "Missing required fields" : undefined}
      data-testid="publish-action-button"
    >
      {publishing ? "Working..." : event.publish ? "Unpublish" : "Publish"}
    </button>
  );
}

export default PublishActionButton;
