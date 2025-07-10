import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import toast from "react-hot-toast";
import { eventSchema, type EventFormData } from "../schemas/eventSchema";
import { DEFAULT_EVENT_VALUES } from "../config/eventConstants";
import type { EventData } from "../types/event";

export function useEventForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

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

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));

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
