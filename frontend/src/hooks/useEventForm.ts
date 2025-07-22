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

export const useEventForm = (organizerDetails?: any[]) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const { currentUser } = useAuth();
  const { addNotification, scheduleEventReminder } = useNotifications();
  const notification = useToastReplacement();

  const form = useForm<EventFormData>({
    resolver: yupResolver(eventSchema) as any,
    defaultValues: DEFAULT_EVENT_VALUES as any,
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
      const eventPayload = {
        // Required fields with proper defaults
        title: data.title || data.type || "New Event",
        description:
          data.description ||
          `${data.type} - ${data.purpose}`.substring(0, 1000),
        date: formattedDate, // Use properly formatted date
        time: data.time,
        endTime: data.endTime,
        location:
          data.format === "In-person" || data.format === "Hybrid Participation"
            ? data.location || "To Be Determined"
            : undefined,
        type: data.type,
        organizer: data.organizer,
        organizerDetails: organizerDetails || [],
        format: data.format,
        purpose: data.purpose,
        agenda: data.agenda,

        // Optional fields
        hostedBy: data.hostedBy || "@Cloud Marketplace Ministry",
        disclaimer: data.disclaimer || undefined,
        isHybrid: data.format === "Hybrid Participation",
        zoomLink: data.zoomLink || undefined,
        meetingId: data.meetingId || undefined,
        passcode: data.passcode || undefined,
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

      console.log("Submitting event data:", eventPayload);
      console.log("Event data fields:", {
        title: eventPayload.title,
        agenda: eventPayload.agenda,
        agendaLength: eventPayload.agenda?.length,
        roles: eventPayload.roles,
        rolesCount: eventPayload.roles?.length,
        format: eventPayload.format,
        organizer: eventPayload.organizer,
        purpose: eventPayload.purpose,
        purposeLength: eventPayload.purpose?.length,
      });

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
        title: eventPayload.title,
        date: data.date,
        time: data.time,
        endTime: data.endTime,
        location: data.location || "TBD",
      });

      // Add notification to the notification dropdown
      addNotification({
        type: "EVENT_UPDATE",
        title: `New Event: ${eventPayload.title}`,
        message: `Event scheduled for ${data.date} from ${data.time} - ${data.endTime}`,
        isRead: false,
        userId: currentUser?.id || "",
      });
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
    } catch (error: any) {
      console.error("Error creating event:", error);

      // Extract more detailed error information
      let errorMessage =
        "Unable to create your event. Please check your details and try again.";

      if (error.response) {
        // Server responded with error
        console.error("Server error response:", error.response.data);
        errorMessage =
          error.response.data?.message || error.message || errorMessage;
      } else if (error.message) {
        // Client-side error
        errorMessage = error.message;
      }

      notification.error(errorMessage, {
        title: "Event Creation Failed",
        autoCloseDelay: 8000,
        actionButton: {
          text: "Retry Creation",
          onClick: () => {
            // The form data is still available, user can just click submit again
            console.log("Retrying event creation...");
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
