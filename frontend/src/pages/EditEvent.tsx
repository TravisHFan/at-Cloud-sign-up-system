import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import OrganizerSelection from "../components/events/OrganizerSelection";
import { EVENT_TYPES } from "../config/eventConstants";
import { useAuth } from "../hooks/useAuth";
import { useToastReplacement } from "../contexts/NotificationModalContext";
import { eventSchema, type EventFormData } from "../schemas/eventSchema";
import { eventService } from "../services/api";
import type { EventData } from "../types/event";

interface Organizer {
  id: string;
  firstName: string;
  lastName: string;
  systemAuthorizationLevel: string;
  roleInAtCloud?: string;
  gender: "male" | "female";
  avatar: string | null;
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
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    reset,
  } = form;

  // Fetch event data on component mount
  useEffect(() => {
    const fetchEvent = async () => {
      if (!id) {
        notification.error("Invalid event ID");
        navigate("/dashboard/upcoming");
        return;
      }

      try {
        setLoading(true);
        const event = await eventService.getEvent(id);
        setEventData(event);

        // Initialize form with event data
        reset({
          title: event.title || "",
          type: event.type || "",
          format: event.format || "",
          date: event.date
            ? new Date(event.date).toISOString().split("T")[0]
            : "",
          time: event.time || "",
          endTime: event.endTime || "",
          description: event.description || "",
          organizer: event.organizer || "",
          purpose: event.purpose || "",
          agenda: event.agenda || "",
          location: event.location || "",
          zoomLink: event.zoomLink || "",
          disclaimer: event.disclaimer || "",
        });

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
  }, [id, currentUser, notification, navigate, reset]);

  // Convert selectedOrganizers to organizerDetails format
  const organizerDetails = useMemo(() => {
    const allOrganizers = [];

    // Add current user as main organizer first
    if (currentUser) {
      allOrganizers.push({
        name: `${currentUser.firstName} ${currentUser.lastName}`,
        role: currentUser.roleInAtCloud || currentUser.role,
        email: `${currentUser.firstName.toLowerCase()}.${currentUser.lastName.toLowerCase()}@atcloud.org`,
        phone: `+1 (555) 100-${String(
          parseInt(currentUser.id.slice(-4), 16) % 10000
        ).padStart(4, "0")}`,
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
        email: `${organizer.firstName.toLowerCase()}.${organizer.lastName.toLowerCase()}@atcloud.org`,
        phone: `+1 (555) 200-${String(
          parseInt(organizer.id.slice(-4), 16) % 10000
        ).padStart(4, "0")}`,
        avatar: organizer.avatar,
        gender: organizer.gender,
        userId: organizer.id,
      });
    });

    return allOrganizers;
  }, [currentUser, selectedOrganizers]);

  // Initialize organizer field with current user
  useEffect(() => {
    if (!currentUser) return;

    const role = currentUser.roleInAtCloud || currentUser.role;
    const initialOrganizer = `${currentUser.firstName} ${currentUser.lastName} (${role})`;
    setValue("organizer", initialOrganizer);
  }, [setValue, currentUser]);

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
      await eventService.updateEvent(id!, {
        ...data,
        organizerDetails,
      });

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
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Edit Event</h1>
        <p className="text-gray-600 mt-1">
          Update event information and details
        </p>
      </div>

      {/* Event Form */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Basic Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Basic Information
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Event Title */}
              <div className="lg:col-span-2">
                <label
                  htmlFor="event-title"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Event Title
                </label>
                <input
                  {...register("title")}
                  id="event-title"
                  name="title"
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter event title"
                />
                {errors.title && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.title.message}
                  </p>
                )}
              </div>

              {/* Event Type */}
              <div>
                <label
                  htmlFor="event-type"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Event Type
                </label>
                <select
                  {...register("type")}
                  id="event-type"
                  name="type"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select event type</option>
                  {EVENT_TYPES.map((type) => (
                    <option key={type.id} value={type.name}>
                      {type.name}
                    </option>
                  ))}
                </select>
                {errors.type && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.type.message}
                  </p>
                )}
              </div>

              {/* Event Format */}
              <div>
                <label
                  htmlFor="event-format"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Event Format
                </label>
                <select
                  {...register("format")}
                  id="event-format"
                  name="format"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select format</option>
                  <option value="In-Person">In-Person</option>
                  <option value="Virtual">Virtual</option>
                  <option value="Hybrid">Hybrid</option>
                </select>
                {errors.format && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.format.message}
                  </p>
                )}
              </div>

              {/* Date */}
              <div>
                <label
                  htmlFor="event-date"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Date
                </label>
                <input
                  {...register("date")}
                  id="event-date"
                  name="date"
                  type="date"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.date && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.date.message}
                  </p>
                )}
              </div>

              {/* Time */}
              <div>
                <label
                  htmlFor="event-time"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Time
                </label>
                <input
                  {...register("time")}
                  id="event-time"
                  name="time"
                  type="time"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.time && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.time.message}
                  </p>
                )}
              </div>

              {/* End Time */}
              <div>
                <label
                  htmlFor="event-end-time"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  End Time
                </label>
                <input
                  {...register("endTime")}
                  id="event-end-time"
                  name="endTime"
                  type="time"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.endTime && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.endTime.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Event Description */}
          <div>
            <label
              htmlFor="event-description"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Event Description
            </label>
            <textarea
              {...register("description")}
              id="event-description"
              name="description"
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Describe the event in detail"
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600">
                {errors.description.message}
              </p>
            )}
          </div>

          {/* Purpose */}
          <div>
            <label
              htmlFor="event-purpose"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Event Purpose
            </label>
            <textarea
              {...register("purpose")}
              id="event-purpose"
              name="purpose"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="What is the purpose of this event?"
            />
            {errors.purpose && (
              <p className="mt-1 text-sm text-red-600">
                {errors.purpose.message}
              </p>
            )}
          </div>

          {/* Agenda */}
          <div>
            <label
              htmlFor="event-agenda"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Event Agenda
            </label>
            <textarea
              {...register("agenda")}
              id="event-agenda"
              name="agenda"
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Outline the event agenda and schedule"
            />
            {errors.agenda && (
              <p className="mt-1 text-sm text-red-600">
                {errors.agenda.message}
              </p>
            )}
          </div>

          {/* Organizers Section */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Event Organizers
            </h3>
            <div className="space-y-4">
              {/* Main Organizer (read-only) */}
              <div>
                <label
                  htmlFor="main-organizer"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Main Organizer
                </label>
                <input
                  {...register("organizer")}
                  id="main-organizer"
                  name="organizer"
                  type="text"
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                />
              </div>

              {/* Co-organizers */}
              {currentUser && (
                <OrganizerSelection
                  selectedOrganizers={selectedOrganizers}
                  onOrganizersChange={handleOrganizersChange}
                  currentUser={{
                    id: currentUser.id,
                    firstName: currentUser.firstName,
                    lastName: currentUser.lastName,
                    systemAuthorizationLevel: currentUser.role,
                    roleInAtCloud: currentUser.roleInAtCloud,
                    gender: currentUser.gender,
                    avatar: currentUser.avatar || null,
                  }}
                />
              )}
            </div>
          </div>

          {/* Location/Platform Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Location & Platform
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Location */}
              <div>
                <label
                  htmlFor="event-location"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Location
                </label>
                <input
                  {...register("location")}
                  id="event-location"
                  name="location"
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter event location"
                />
                {errors.location && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.location.message}
                  </p>
                )}
              </div>

              {/* Zoom Link */}
              <div>
                <label
                  htmlFor="zoom-link"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Zoom Link (if virtual)
                </label>
                <input
                  {...register("zoomLink")}
                  id="zoom-link"
                  name="zoomLink"
                  type="url"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://zoom.us/j/..."
                />
                {errors.zoomLink && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.zoomLink.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Disclaimer */}
          <div>
            <label
              htmlFor="event-disclaimer"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Disclaimer Terms
            </label>
            <textarea
              {...register("disclaimer")}
              id="event-disclaimer"
              name="disclaimer"
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
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => navigate("/dashboard/upcoming")}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>

              <div className="flex items-center gap-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-400"
                >
                  {isSubmitting ? "Updating..." : "Update Event"}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
