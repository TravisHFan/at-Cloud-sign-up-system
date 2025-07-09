import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import toast from "react-hot-toast";
import { eventSchema, type EventFormData } from "../schemas/eventSchema";
import { DEFAULT_EVENT_VALUES } from "../config/eventConstants";

export function useEventForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const form = useForm<EventFormData>({
    resolver: yupResolver<EventFormData, any, any>(eventSchema),
    defaultValues: {
      ...DEFAULT_EVENT_VALUES,
      // Add missing defaults to prevent undefined values
      title: "",
      description: "",
      date: "",
      time: "",
      location: "",
      category: "",
      requirements: "",
      materials: "",
      zoomLink: "",
    },
  });

  const { handleSubmit, watch, reset } = form;
  const watchIsHybrid = watch("isHybrid");
  const watchAllFields = watch();

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
        title: "",
        description: "",
        date: "",
        time: "",
        location: "",
        category: "",
        requirements: "",
        materials: "",
        zoomLink: "",
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
