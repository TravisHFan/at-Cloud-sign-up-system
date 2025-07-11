import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import toast from "react-hot-toast";
import { eventSchema, type EventFormData } from "../schemas/eventSchema";
import { DEFAULT_EVENT_VALUES } from "../config/eventConstants";
import type { EventData } from "../types/event";
import { emailNotificationService } from "../utils/emailNotificationService";
import { useAuth } from "./useAuth";
import { useNotifications } from "../contexts/NotificationContext";

export function useEventForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const { currentUser } = useAuth();
  const { addSystemMessage, addNotification, scheduleEventReminder } =
    useNotifications();

  const form = useForm<EventFormData>({
    resolver: yupResolver(eventSchema) as any,
    defaultValues: DEFAULT_EVENT_VALUES as any,
  });

  const { handleSubmit, watch, reset } = form;
  const watchIsHybrid = watch("isHybrid");
  const watchAllFields = watch() as EventData; // Explicitly type as EventData

  const onSubmit = async (data: EventFormData) => {
    setIsSubmitting(true);

    try {
      console.log("Creating event:", data);

      // Simulate API call - In real implementation, this would create the event in the backend
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Mock event data for notifications
      const eventData = {
        id: Math.random().toString(36).substr(2, 9), // Generate random ID for demo
        title: data.title,
        date: data.date,
        time: data.time,
        location: data.location,
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

        // If there are co-organizers specified in the organizer field, send them special notifications
        if (data.organizer && data.organizer.includes(",")) {
          // Parse multiple organizers (this is a simplified approach)
          const organizers = data.organizer.split(",").map((org) => org.trim());
          // For demo purposes, assume second organizer is a co-organizer
          if (organizers.length > 1) {
            // In real implementation, you'd extract the email from the organizer selection
            const coOrganizerEmail = "co-organizer@example.com"; // This should come from actual organizer selection
            await emailNotificationService.sendCoOrganizerAssignmentNotification(
              {
                ...eventData,
                coOrganizerName: organizers[1].split("(")[0].trim(), // Extract name before role
              },
              coOrganizerEmail,
              currentUser
                ? `${currentUser.firstName} ${currentUser.lastName}`
                : "Event Creator"
            );
          }
        } // Schedule reminder notification for 1 day before the event
        await emailNotificationService.scheduleEventReminder(eventData);

        // Schedule reminder in notification system
        scheduleEventReminder({
          id: eventData.id,
          title: data.title,
          date: data.date,
          time: data.time,
          location: data.location || "TBD",
        });

        // Add system message notification for all users
        addSystemMessage({
          title: `New Event: ${data.title}`,
          content: `A new event "${data.title}" has been created for ${data.date} at ${data.time}. Location: ${data.location}. Organized by ${eventData.organizerName}.`,
          type: "announcement",
          priority: "medium",
          isRead: false,
        });

        // Add notification to the notification dropdown
        addNotification({
          type: "system",
          title: `New Event: ${data.title}`,
          message: `Event scheduled for ${data.date} at ${data.time}`,
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
        id: 0,
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
        createdBy: 0,
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
