import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { useToastReplacement } from "../contexts/NotificationModalContext";
import { eventSchema, type EventFormData } from "../schemas/eventSchema";
import { DEFAULT_EVENT_VALUES } from "../config/eventConstants";
import { useAuth } from "./useAuth";
import { useNotifications } from "../contexts/NotificationContext";
import { eventService } from "../services/api";
import { normalizeEventDate } from "../utils/eventStatsUtils";

export type RecurringConfig = {
  isRecurring?: boolean;
  frequency?: "every-two-weeks" | "monthly" | "every-two-months" | null;
  occurrenceCount?: number | null;
} | null;

type SimpleOrganizer = { id?: string; name?: string; [k: string]: unknown };

export const useEventForm = (
  organizerDetails?: SimpleOrganizer[],
  recurringConfig?: RecurringConfig
) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const { currentUser } = useAuth();
  const { scheduleEventReminder } = useNotifications();
  const notification = useToastReplacement();

  const form = useForm<EventFormData>({
    // Resolver typing from @hookform/resolvers can be broad; cast to satisfy TS
    resolver: yupResolver(eventSchema) as unknown as any,
    defaultValues: DEFAULT_EVENT_VALUES as unknown as EventFormData,
  });

  const { handleSubmit, watch, reset } = form;
  const watchIsHybrid = watch("isHybrid");
  const watchAllFields = watch(); // Remove the EventData type casting that was causing the error

  const onSubmit = async (data: EventFormData) => {
    setIsSubmitting(true);

    try {
      // Ensure date is properly formatted to avoid timezone issues
      const formattedDate = normalizeEventDate(data.date);

      // Transform form data to match backend API expectations
      const eventPayload: Record<string, unknown> = {
        // Required fields with proper defaults
        title: data.title || data.type || "New Event",
        date: formattedDate, // Use properly formatted date
        endDate: data.endDate || formattedDate,
        time: data.time,
        endTime: data.endTime,
        location:
          data.format === "In-person" || data.format === "Hybrid Participation"
            ? data.location || "To Be Determined"
            : "Online Event", // Provide a default value for Online events
        type: data.type,
        organizer: data.organizer,
        organizerDetails: organizerDetails || [],
        format: data.format,
        purpose: data.purpose,
        agenda: data.agenda,
        timeZone: (data as unknown as { timeZone?: string }).timeZone,

        // Optional fields - only omit if truly undefined/null, preserve empty strings for validation
        hostedBy: data.hostedBy || "@Cloud Marketplace Ministry",
        disclaimer: data.disclaimer || undefined,
        isHybrid: data.format === "Hybrid Participation",
        // Only include zoomLink for Online and Hybrid events
        ...(data.format === "Online" || data.format === "Hybrid Participation"
          ? { zoomLink: data.zoomLink }
          : {}),
        meetingId: data.meetingId,
        passcode: data.passcode,
        requirements: data.requirements || undefined,
        materials: data.materials || undefined,

        // Provide basic role structure if no roles configured
        roles:
          data.roles && data.roles.length > 0
            ? data.roles
            : [
                {
                  id: "participant",
                  name: "Participant",
                  description: "General event participant",
                  maxParticipants: 50,
                  currentSignups: [],
                },
              ],
        signedUp: 0,
        totalSlots:
          data.roles && data.roles.length > 0
            ? data.roles.reduce(
                (total, role) => total + (role.maxParticipants || 0),
                0
              )
            : 50, // Fallback to 50 only if no roles are configured
      };

      // Attach recurring configuration if provided and valid
      if (
        recurringConfig?.isRecurring &&
        recurringConfig.frequency &&
        typeof recurringConfig.occurrenceCount === "number"
      ) {
        eventPayload.recurring = {
          isRecurring: true,
          frequency: recurringConfig.frequency,
          occurrenceCount: recurringConfig.occurrenceCount,
        };
      }

      // Create event using backend API
      const createdEvent = await eventService.createEvent(eventPayload);

      // Use the actual event data returned from backend
      const eventData = {
        id: createdEvent.id,
        title: createdEvent.title || eventPayload.title,
        date: createdEvent.date,
        time: createdEvent.time,
        endTime: createdEvent.endTime,
        location: createdEvent.location || "TBD",
        organizerName: currentUser
          ? `${currentUser.firstName} ${currentUser.lastName}`
          : "Unknown Organizer",
      };

      // Schedule reminder in notification system
      scheduleEventReminder({
        id: eventData.id,
        title: String(eventData.title || eventPayload.title || "Event"),
        date: data.date,
        time: data.time,
        endTime: data.endTime,
        location: data.location || "TBD",
      });

      // Combined range used by server-driven notifications; client no longer displays a local bell

      // Do NOT add a local bell notification here.
      // The backend emits a system_message_update which the NotificationProvider
      // converts into a bell notification. Creating one locally causes a brief duplicate
      // that disappears when the real one arrives/refetches.
      notification.success(
        "Event created successfully! All users will be notified about the new event.",
        {
          title: "Event Created",
          autoCloseDelay: 4000,
          actionButton: {
            text: "View Events",
            onClick: () => {
              // Navigate to events list
              window.location.href = "/dashboard/upcoming";
            },
            variant: "primary",
          },
        }
      );

      // Reset form to default values
      reset(DEFAULT_EVENT_VALUES);
      setShowPreview(false);
    } catch (error: unknown) {
      console.error("Error creating event:", error);

      // Extract more detailed error information
      let errorMessage =
        "Unable to create your event. Please check your details and try again.";

      if ((error as any)?.response) {
        // Server responded with error
        console.error("Server error response:", (error as any).response.data);
        errorMessage =
          (error as any).response.data?.message ||
          (error as { message?: string })?.message ||
          errorMessage;
      } else if ((error as { message?: string })?.message) {
        // Client-side error
        errorMessage = (error as { message?: string }).message as string;
      }

      notification.error(errorMessage, {
        title: "Event Creation Failed",
        autoCloseDelay: 8000,
        actionButton: {
          text: "Retry Creation",
          onClick: () => {
            // The form data is still available, user can just click submit again
          },
          variant: "primary",
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePreview = () => setShowPreview(!showPreview);
  const hidePreview = () => setShowPreview(false);

  return {
    // Form state
    form,
    isSubmitting,
    showPreview,

    // Watched values
    watchIsHybrid,
    watchAllFields,

    // Actions
    onSubmit: handleSubmit(onSubmit),
    togglePreview,
    hidePreview,
  };
};
