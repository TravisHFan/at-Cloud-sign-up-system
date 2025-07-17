import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import toast from "react-hot-toast";
import { eventSchema, type EventFormData } from "../schemas/eventSchema";
import { DEFAULT_EVENT_VALUES } from "../config/eventConstants";
import { emailNotificationService } from "../utils/emailNotificationService";
import { systemMessageIntegration } from "../utils/systemMessageIntegration";
import { useAuth } from "./useAuth";
import { useNotifications } from "../contexts/NotificationContext";
import { eventService } from "../services/api";

interface OrganizerInfo {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export function useEventForm(additionalOrganizers: OrganizerInfo[] = []) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const { currentUser } = useAuth();
  const { addNotification, scheduleEventReminder } = useNotifications();

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

      // Create event using backend API
      const createdEvent = await eventService.createEvent({
        title: data.title,
        description: data.description,
        date: data.date,
        time: data.time,
        endTime: data.endTime,
        location: data.location,
        type: data.type,
        organizer: data.organizer,
        hostedBy: data.hostedBy,
        purpose: data.purpose,
        agenda: data.agenda,
        format: data.format,
        disclaimer: data.disclaimer,
        roles: data.roles,
        category: data.category,
        isHybrid: data.isHybrid,
        zoomLink: data.zoomLink,
        meetingId: data.meetingId,
        passcode: data.passcode,
        requirements: data.requirements,
        materials: data.materials,
      });


      // Use the actual event data returned from backend
      const eventData = {
        id: createdEvent.id,
        title: createdEvent.title,
        date: createdEvent.date,
        time: createdEvent.time,
        endTime: createdEvent.endTime,
        location: createdEvent.location || "TBD",
        organizerName: currentUser
          ? `${currentUser.firstName} ${currentUser.lastName}`
          : "Unknown Organizer",
      };

      // Send event creation notifications to all users except the organizer
      try {
        await emailNotificationService.sendEventCreatedNotification(
          eventData,
          currentUser?.email || ""
        );

        // Send co-organizer notifications to additional organizers
        if (additionalOrganizers.length > 0) {
          for (const coOrganizer of additionalOrganizers) {
            try {
              await emailNotificationService.sendCoOrganizerAssignmentNotification(
                {
                  ...eventData,
                  coOrganizerName: `${coOrganizer.firstName} ${coOrganizer.lastName}`,
                },
                coOrganizer.email,
                currentUser
                  ? `${currentUser.firstName} ${currentUser.lastName}`
                  : "Event Creator"
              );
            } catch (emailError) {
              console.error(
                `Failed to send co-organizer notification to ${coOrganizer.email}:`,
                emailError
              );
              // Continue with other organizers even if one fails
            }
          }
        } // Schedule reminder notification for 1 day before the event
        await emailNotificationService.scheduleEventReminder(eventData);

        // Schedule reminder in notification system
        scheduleEventReminder({
          id: eventData.id,
          title: data.title,
          date: data.date,
          time: data.time,
          endTime: data.endTime,
          location: data.location || "TBD",
        });

        // Send system message for event creation (message from organizer)
        systemMessageIntegration.sendEventCreatedSystemMessage(
          {
            id: eventData.id,
            title: data.title,
            date: data.date,
            time: data.time,
            endTime: data.endTime,
            location: data.location || "TBD",
            organizerName: eventData.organizerName,
          },
          currentUser?.id || "unknown"
        );

        // Send system message for co-organizer assignment if applicable
        if (additionalOrganizers.length > 0) {
          systemMessageIntegration.sendCoOrganizerAssignmentSystemMessage(
            {
              id: eventData.id,
              title: data.title,
              date: data.date,
              time: data.time,
              endTime: data.endTime,
              location: data.location || "TBD",
              organizerName: eventData.organizerName,
            },
            currentUser?.id || "unknown"
          );
        }

        // Add notification to the notification dropdown
        addNotification({
          type: "system",
          title: `New Event: ${data.title}`,
          message: `Event scheduled for ${data.date} from ${data.time} - ${data.endTime}`,
          isRead: false,
        });

        toast.success(
          "Event created successfully! Notifications sent to all users."
        );
      } catch (emailError) {
        console.warn(
          "Event created but failed to send notifications:",
          emailError
        );
        toast.success(
          "Event created successfully! (Note: Some notifications may have failed)"
        );
      }

      toast.success("Event created successfully!");

      // Reset to proper defaults
      reset({
        ...DEFAULT_EVENT_VALUES,
        id: "",
        title: "",
        description: "",
        date: "",
        time: "",
        location: "",
        category: "",
        requirements: "",
        materials: "",
        zoomLink: "",
        meetingId: "",
        passcode: "",
        type: "Workshop",
        organizer: "",
        purpose: "",
        format: "In-person",
        disclaimer: "",
        roles: [
          {
            id: "default-role",
            name: "Default Role",
            description: "Default role description",
            maxParticipants: 10,
            currentSignups: [], // Strictly defined as an empty array
          },
        ],
        signedUp: 0,
        totalSlots: 0,
        createdBy: "",
        createdAt: "2025-01-01T00:00:00Z",
      });

      setShowPreview(false);
    } catch (error) {
      console.error("Error creating event:", error);
      toast.error("Failed to create event. Please try again.");
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
}
