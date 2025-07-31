import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import OrganizerSelection from "../components/events/OrganizerSelection";
import ValidationIndicator from "../components/events/ValidationIndicator";
import { EVENT_TYPES } from "../config/eventConstants";
import { useAuth } from "../hooks/useAuth";
import { useToastReplacement } from "../contexts/NotificationModalContext";
import { useEventValidation } from "../hooks/useEventValidation";
import { eventSchema, type EventFormData } from "../schemas/eventSchema";
import { eventService } from "../services/api";
import type { EventData } from "../types/event";
import {
  parseEventDateSafely,
  normalizeEventDate,
  handleDateInputChange,
} from "../utils/eventStatsUtils";

interface Organizer {
  id: string;
  firstName: string;
  lastName: string;
  systemAuthorizationLevel: string;
  roleInAtCloud?: string;
  gender: "male" | "female";
  avatar: string | null;
  email: string; // Add email field
  phone?: string; // Add phone field
}

export default function EditEvent() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const notification = useToastReplacement();
  const [selectedOrganizers, setSelectedOrganizers] = useState<Organizer[]>([]);
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<EventFormData>({
    resolver: yupResolver(eventSchema) as any,
    defaultValues: {
      title: "",
      type: "",
      format: "",
      date: "",
      time: "",
      endTime: "",
      description: "",
      organizer: "",
      purpose: "",
      agenda: "",
      location: "",
      zoomLink: "",
      meetingId: "",
      passcode: "",
      disclaimer: "",
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    reset,
    watch,
  } = form;

  // Add validation hook and watch functionality
  const { validations } = useEventValidation(watch);

  // Watch the format field to show/hide conditional fields
  const selectedFormat = watch("format");

  // Fetch event data on component mount
  useEffect(() => {
    if (!id) return;

    const fetchEvent = async () => {
      try {
        setLoading(true);
        console.log("🔍 Fetching event with ID:", id);
        const event = await eventService.getEvent(id);
        console.log("🔍 Raw API response:", event);
        setEventData(event);

        // Initialize form with event data
        const currentUserRole =
          currentUser?.roleInAtCloud || currentUser?.role || "";
        const mainOrganizer =
          event.organizer ||
          `${currentUser?.firstName || ""} ${
            currentUser?.lastName || ""
          } (${currentUserRole})`;

        reset({
          title: event.title || "",
          type: event.type || "",
          format: event.format || "",
          date: parseEventDateSafely(event.date),
          time: event.time || "",
          endTime: event.endTime || "",
          description: event.description || "",
          organizer: mainOrganizer,
          purpose: event.purpose || "",
          agenda: event.agenda || "",
          location: event.location || "",
          zoomLink: event.zoomLink || "",
          meetingId: event.meetingId || "",
          passcode: event.passcode || "",
          disclaimer: event.disclaimer || "",
        });

        // Debug: Log form state after reset
        console.log("🔍 Form reset completed. Values set:");
        console.log("  - type:", event.type);
        console.log("  - format:", event.format);
        console.log("  - title:", event.title);

        // Force update the form field if event type exists and is valid
        if (event.type && EVENT_TYPES.some((t) => t.name === event.type)) {
          console.log("🔧 Force setting type value:", event.type);
          setValue("type", event.type, {
            shouldValidate: true,
            shouldDirty: true,
          });
        }

        console.log("Event data loaded for editing:", {
          title: event.title,
          type: event.type,
          format: event.format,
        });

        // Debug: Check if event type exists in EVENT_TYPES array
        console.log(
          "🔍 EVENT_TYPES available:",
          EVENT_TYPES.map((t) => t.name)
        );
        console.log("🔍 Event type from API:", event.type);
        const typeExists = EVENT_TYPES.some((t) => t.name === event.type);
        console.log(
          "🔍 Does event type exist in dropdown options?",
          typeExists
        );

        if (!typeExists && event.type) {
          console.warn(
            "⚠️ Event type mismatch! Database has:",
            event.type,
            "but dropdown only has:",
            EVENT_TYPES.map((t) => t.name)
          );
          console.log(
            "🔧 This is likely why the dropdown shows 'Select event type' instead of the current value"
          );
        }

        // Debug: Check current form values
        setTimeout(() => {
          console.log("🔍 Form state check - current form values:");
          console.log("  - watch('type'):", watch("type"));
          console.log("  - watch('format'):", watch("format"));
          console.log("  - watch('title'):", watch("title"));
        }, 100);

        // Parse organizers from event data if available
        if (event.organizerDetails && Array.isArray(event.organizerDetails)) {
          const coOrganizers = event.organizerDetails
            .filter((org: any) => org.userId !== currentUser?.id)
            .map((org: any) => ({
              id: org.userId,
              firstName: org.name.split(" ")[0],
              lastName: org.name.split(" ").slice(1).join(" "),
              systemAuthorizationLevel: org.role,
              roleInAtCloud: org.role,
              gender: org.gender,
              avatar: org.avatar,
            }));

          setSelectedOrganizers(coOrganizers);
        }
      } catch (error) {
        console.error("Error fetching event:", error);
        notification.error("Failed to load event data");
        navigate("/dashboard/upcoming");
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [id]); // Only depend on id to prevent infinite loops

  // Convert selectedOrganizers to organizerDetails format
  const organizerDetails = useMemo(() => {
    const allOrganizers = [];

    // Add current user as main organizer first
    if (currentUser) {
      allOrganizers.push({
        name: `${currentUser.firstName} ${currentUser.lastName}`,
        role: currentUser.roleInAtCloud || currentUser.role,
        email: currentUser.email, // Use real email from database
        phone: currentUser.phone || "Phone not provided", // Use real phone or indicate not provided
        avatar: currentUser.avatar,
        gender: currentUser.gender,
        userId: currentUser.id,
      });
    }

    // Add selected co-organizers
    selectedOrganizers.forEach((organizer) => {
      allOrganizers.push({
        name: `${organizer.firstName} ${organizer.lastName}`,
        role: organizer.roleInAtCloud || organizer.systemAuthorizationLevel,
        email: organizer.email || "Email not available", // Use real email from organizer data
        phone: organizer.phone || "Phone not provided", // Use real phone from organizer data
        avatar: organizer.avatar,
        gender: organizer.gender,
        userId: organizer.id,
      });
    });

    return allOrganizers;
  }, [currentUser, selectedOrganizers]);

  // Update form's organizer field whenever organizers change
  const handleOrganizersChange = (newOrganizers: Organizer[]) => {
    setSelectedOrganizers(newOrganizers);

    if (!currentUser) return;

    // Convert current user to Organizer format
    const currentUserAsOrganizer: Organizer = {
      id: currentUser.id,
      firstName: currentUser.firstName,
      lastName: currentUser.lastName,
      systemAuthorizationLevel: currentUser.role,
      roleInAtCloud: currentUser.roleInAtCloud,
      gender: currentUser.gender,
      avatar: currentUser.avatar || null,
      email: currentUser.email, // Include real email
      phone: currentUser.phone, // Include phone from user data
    };

    // Update the form's organizer field
    const allOrganizers = [currentUserAsOrganizer, ...newOrganizers];
    const formattedOrganizers = allOrganizers
      .map((org) => {
        const role = org.roleInAtCloud || org.systemAuthorizationLevel;
        return `${org.firstName} ${org.lastName} (${role})`;
      })
      .join(", ");

    setValue("organizer", formattedOrganizers);
  };

  // Submit handler for editing
  const onSubmit = async (data: EventFormData) => {
    try {
      setIsSubmitting(true);

      // Debug logging to track the date transformation
      console.log("🔍 EditEvent submission data.date (raw):", data.date);
      console.log("🔍 EditEvent submission data.date type:", typeof data.date);

      // Ensure date is properly formatted to avoid timezone issues
      const normalizedDate = normalizeEventDate(data.date);
      console.log("🔍 EditEvent submission normalizedDate:", normalizedDate);

      const formattedData = {
        ...data,
        date: normalizedDate,
        organizerDetails,
      };

      console.log("🔍 EditEvent final payload date:", formattedData.date);

      await eventService.updateEvent(id!, formattedData);
      notification.success("Event updated successfully!", {
        title: "Success",
        autoCloseDelay: 3000,
      });

      navigate("/dashboard/upcoming");
    } catch (error) {
      console.error("Error updating event:", error);
      notification.error("Failed to update event. Please try again.", {
        title: "Update Failed",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!eventData) {
    return (
      <div className="text-center text-red-600">
        Event not found or failed to load.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Event</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Event Title <span className="text-red-500">*</span>
            </label>
            <input
              {...register("title")}
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter event title"
            />
            <ValidationIndicator validation={validations.title} />
            {errors.title && (
              <p className="mt-1 text-sm text-red-600">
                {errors.title.message}
              </p>
            )}
          </div>

          {/* Event Type - Dropdown selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Event Type <span className="text-red-500">*</span>
            </label>
            <select
              {...register("type")}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select event type</option>
              {EVENT_TYPES.map((eventType) => (
                <option key={eventType.id} value={eventType.name}>
                  {eventType.name}
                </option>
              ))}
            </select>
            <ValidationIndicator validation={validations.type} />
            {errors.type && (
              <p className="mt-1 text-sm text-red-600">{errors.type.message}</p>
            )}
          </div>

          {/* Basic Event Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                {...register("date", {
                  onChange: (e) => {
                    console.log(
                      "🔍 EditEvent date input onChange:",
                      e.target.value
                    );
                    const normalizedDate = handleDateInputChange(
                      e.target.value
                    );
                    console.log(
                      "🔍 EditEvent setting date to:",
                      normalizedDate
                    );
                    setValue("date", normalizedDate);
                  },
                })}
                type="date"
                min={new Date().toISOString().split("T")[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <ValidationIndicator validation={validations.date} />
              {errors.date && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.date.message}
                </p>
              )}
            </div>

            {/* Start Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Time <span className="text-red-500">*</span>
              </label>
              <input
                {...register("time")}
                type="time"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <ValidationIndicator validation={validations.time} />
              {errors.time && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.time.message}
                </p>
              )}
            </div>

            {/* End Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Time <span className="text-red-500">*</span>
              </label>
              <input
                {...register("endTime")}
                type="time"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <ValidationIndicator validation={validations.endTime} />
              {errors.endTime && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.endTime.message}
                </p>
              )}
            </div>
          </div>

          {/* Hosted by */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Hosted by
            </label>
            <input
              {...register("hostedBy")}
              type="text"
              value="@Cloud Marketplace Ministry"
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600 cursor-not-allowed"
            />
            <p className="mt-1 text-sm text-gray-500">
              This field cannot be changed
            </p>
          </div>

          {/* Organizers */}
          {currentUser && (
            <OrganizerSelection
              currentUser={{
                id: currentUser.id,
                firstName: currentUser.firstName,
                lastName: currentUser.lastName,
                systemAuthorizationLevel: currentUser.role,
                roleInAtCloud: currentUser.roleInAtCloud,
                gender: currentUser.gender,
                avatar: currentUser.avatar || null,
                email: currentUser.email,
                phone: currentUser.phone,
              }}
              selectedOrganizers={selectedOrganizers}
              onOrganizersChange={handleOrganizersChange}
            />
          )}

          {/* Purpose */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Purpose <span className="text-red-500">*</span>
            </label>
            <textarea
              {...register("purpose")}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Describe the purpose of this event"
            />
            <ValidationIndicator validation={validations.purpose} />
            {errors.purpose && (
              <p className="mt-1 text-sm text-red-600">
                {errors.purpose.message}
              </p>
            )}
          </div>

          {/* Event Agenda and Schedule */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Event Agenda and Schedule <span className="text-red-500">*</span>
            </label>
            <textarea
              {...register("agenda")}
              rows={5}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Provide a detailed agenda and schedule for the event (e.g., 9:00 AM - Registration, 9:30 AM - Opening Session, etc.)"
            />
            <ValidationIndicator validation={validations.agenda} />
            {errors.agenda && (
              <p className="mt-1 text-sm text-red-600">
                {errors.agenda.message}
              </p>
            )}
          </div>

          {/* Format */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Format <span className="text-red-500">*</span>
            </label>
            <select
              {...register("format")}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select format</option>
              <option value="Hybrid Participation">Hybrid Participation</option>
              <option value="In-person">In-person</option>
              <option value="Online">Online</option>
            </select>
            <ValidationIndicator validation={validations.format} />
            {errors.format && (
              <p className="mt-1 text-sm text-red-600">
                {errors.format.message}
              </p>
            )}
          </div>

          {/* Conditional Location Field */}
          {(selectedFormat === "Hybrid Participation" ||
            selectedFormat === "In-person") && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location <span className="text-red-500">*</span>
              </label>
              <input
                {...register("location")}
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter event location"
              />
              <ValidationIndicator validation={validations.location} />
              {errors.location && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.location.message}
                </p>
              )}
            </div>
          )}

          {/* Conditional Zoom Information Fields */}
          {(selectedFormat === "Hybrid Participation" ||
            selectedFormat === "Online") && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Zoom Information
              </h3>

              {/* Zoom Link */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Zoom Link <span className="text-red-500">*</span>
                </label>
                <input
                  {...register("zoomLink")}
                  type="url"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter Zoom meeting link"
                />
                <ValidationIndicator validation={validations.zoomLink} />
                {errors.zoomLink && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.zoomLink.message}
                  </p>
                )}
              </div>

              {/* Meeting ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Meeting ID
                </label>
                <input
                  {...register("meetingId")}
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter Meeting ID (optional)"
                />
              </div>

              {/* Passcode */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Passcode
                </label>
                <input
                  {...register("passcode")}
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter passcode (optional)"
                />
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Disclaimer Terms
            </label>
            <textarea
              {...register("disclaimer")}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter disclaimer terms and conditions"
            />
            {errors.disclaimer && (
              <p className="mt-1 text-sm text-red-600">
                {errors.disclaimer.message}
              </p>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-between pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={() => navigate("/dashboard/upcoming")}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-400"
            >
              {isSubmitting ? "Updating..." : "Update Event"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
