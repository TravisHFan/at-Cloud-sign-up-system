import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { COMMON_TIMEZONES } from "../data/timeZones";
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
  getTodayDateString,
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
      endDate: "",
      time: "",
      endTime: "",
      timeZone:
        typeof Intl !== "undefined"
          ? Intl.DateTimeFormat().resolvedOptions().timeZone ||
            "America/Los_Angeles"
          : "America/Los_Angeles",
      organizer: "",
      purpose: "",
      agenda: "",
      location: "",
      zoomLink: "",
      meetingId: "",
      passcode: "",
      disclaimer: "",
      hostedBy: "",
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    setValue,
    reset,
    watch,
  } = form;

  // Register hidden validation fields so updates trigger re-render
  useEffect(() => {
    (register as any)("__startOverlapValidation");
    (register as any)("__endOverlapValidation");
    setValue(
      "__startOverlapValidation" as any,
      { isValid: true, message: "", color: "text-gray-500" } as any,
      { shouldDirty: false, shouldValidate: false }
    );
    setValue(
      "__endOverlapValidation" as any,
      { isValid: true, message: "", color: "text-gray-500" } as any,
      { shouldDirty: false, shouldValidate: false }
    );
  }, [register, setValue]);

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
        const event = await eventService.getEvent(id);
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
          endDate: parseEventDateSafely((event as any).endDate || event.date),
          time: event.time || "",
          endTime: event.endTime || "",
          organizer: mainOrganizer,
          purpose: event.purpose || "",
          agenda: event.agenda || "",
          location: event.location || "",
          zoomLink: event.zoomLink || "",
          meetingId: event.meetingId || "",
          passcode: event.passcode || "",
          disclaimer: event.disclaimer || "",
          hostedBy: event.hostedBy || "",
          timeZone:
            event.timeZone ||
            (typeof Intl !== "undefined"
              ? Intl.DateTimeFormat().resolvedOptions().timeZone ||
                "America/Los_Angeles"
              : "America/Los_Angeles"),
        });

        // Force update the form field if event type exists and is valid
        if (event.type && EVENT_TYPES.some((t) => t.name === event.type)) {
          setValue("type", event.type, {
            shouldValidate: true,
            shouldDirty: false,
          });
        }

        // Check if event type exists in EVENT_TYPES array
        const typeExists = EVENT_TYPES.some((t) => t.name === event.type);

        if (!typeExists && event.type) {
          // Event type mismatch - database has type not in dropdown options
          // This could cause the dropdown to show 'Select event type' instead of current value
        }

        // Parse organizers from event data if available
        if (event.organizerDetails && Array.isArray(event.organizerDetails)) {
          const mainId = (event as any)?.createdBy?.id || event.createdBy;
          const coOrganizers = event.organizerDetails
            .filter((org: any) => org.userId !== mainId)
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

  // Convert selectedOrganizers to organizerDetails format (co-organizers only)
  const organizerDetails = useMemo(() => {
    return selectedOrganizers.map((organizer) => ({
      name: `${organizer.firstName} ${organizer.lastName}`,
      role: organizer.roleInAtCloud || organizer.systemAuthorizationLevel,
      email: organizer.email || "Email not available",
      phone: organizer.phone || "Phone not provided",
      avatar: organizer.avatar,
      gender: organizer.gender,
      userId: organizer.id,
    }));
  }, [selectedOrganizers]);

  // Update form's organizer field whenever organizers change
  const handleOrganizersChange = (newOrganizers: Organizer[]) => {
    setSelectedOrganizers(newOrganizers);

    // Build organizer string as: Main Organizer + co-organizers
    const mainFirst =
      (eventData as any)?.createdBy?.firstName || currentUser?.firstName || "";
    const mainLast =
      (eventData as any)?.createdBy?.lastName || currentUser?.lastName || "";
    const mainRole =
      (eventData as any)?.createdBy?.roleInAtCloud ||
      (eventData as any)?.createdBy?.role ||
      currentUser?.roleInAtCloud ||
      (currentUser as any)?.role ||
      "";
    const mainLabel = `${mainFirst} ${mainLast} (${mainRole})`;

    const formattedOrganizers = [
      mainLabel,
      ...newOrganizers.map((org) => {
        const role = org.roleInAtCloud || org.systemAuthorizationLevel;
        return `${org.firstName} ${org.lastName} (${role})`;
      }),
    ]
      .filter(Boolean)
      .join(", ");

    setValue("organizer", formattedOrganizers, {
      shouldDirty: true,
      shouldValidate: false,
    });
  };

  // Submit handler for editing
  const onSubmit = async (data: EventFormData) => {
    try {
      setIsSubmitting(true);

      // Ensure date is properly formatted to avoid timezone issues
      const normalizedDate = normalizeEventDate(data.date);

      const formattedData = {
        ...data,
        date: normalizedDate,
        endDate: (data as any).endDate || normalizedDate,
        organizerDetails,
        timeZone: (data as any).timeZone,
      };

      // Handle Zoom fields based on format
      if (data.format === "Online" || data.format === "Hybrid Participation") {
        // Include all Zoom fields for Online and Hybrid events
        formattedData.zoomLink = data.zoomLink || "";
        formattedData.meetingId = data.meetingId || "";
        formattedData.passcode = data.passcode || "";
      } else if (data.format === "In-person") {
        // Remove zoomLink completely for In-person events to avoid validation issues
        if (formattedData.zoomLink !== undefined) {
          delete formattedData.zoomLink;
        }
        if (formattedData.meetingId !== undefined) {
          delete formattedData.meetingId;
        }
        if (formattedData.passcode !== undefined) {
          delete formattedData.passcode;
        }
      }

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

          {/* Time Zone (full-width row) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Time Zone <span className="text-red-500">*</span>
            </label>
            <select
              {...register("timeZone")}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 max-h-48 overflow-y-auto"
            >
              {COMMON_TIMEZONES.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Times are stored in this time zone and displayed in viewers' local
              time.
            </p>
          </div>

          {/* Dates and Times (responsive grid) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date <span className="text-red-500">*</span>
              </label>
              <input
                {...register("date", {
                  onChange: (e) => {
                    const normalizedDate = handleDateInputChange(
                      e.target.value
                    );
                    setValue("date", normalizedDate, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                  },
                })}
                type="date"
                min={getTodayDateString()}
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
                {...register("time", {
                  onBlur: async () => {
                    const sDate = (watch() as any).date;
                    const sTime = (watch() as any).time;
                    if (!sDate || !sTime) return;
                    try {
                      const result = await eventService.checkTimeConflict({
                        startDate: sDate,
                        startTime: sTime,
                        mode: "point",
                        excludeId: id,
                        timeZone: (watch() as any).timeZone,
                      });
                      if (result.conflict) {
                        setValue(
                          "__startOverlapValidation" as any,
                          {
                            isValid: false,
                            message:
                              "Time overlap: this start time falls within another event. Please choose another.",
                            color: "text-red-500",
                          } as any,
                          { shouldDirty: false, shouldValidate: false }
                        );
                      } else {
                        setValue(
                          "__startOverlapValidation" as any,
                          {
                            isValid: true,
                            message: "",
                            color: "text-green-500",
                          } as any,
                          { shouldDirty: false, shouldValidate: false }
                        );
                      }
                    } catch (e) {
                      setValue(
                        "__startOverlapValidation" as any,
                        {
                          isValid: true,
                          message: "",
                          color: "text-gray-500",
                        } as any,
                        { shouldDirty: false, shouldValidate: false }
                      );
                    }
                  },
                })}
                type="time"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <ValidationIndicator validation={validations.time} />
              <ValidationIndicator validation={validations.startOverlap!} />
              {errors.time && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.time.message}
                </p>
              )}
            </div>
            {/* End Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date <span className="text-red-500">*</span>
              </label>
              <input
                {...register("endDate", {
                  onChange: (e) => {
                    const normalizedDate = handleDateInputChange(
                      e.target.value
                    );
                    setValue("endDate", normalizedDate, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                  },
                })}
                type="date"
                min={getTodayDateString()}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <ValidationIndicator validation={validations.endDate} />
              {(errors as any)?.endDate && (
                <p className="mt-1 text-sm text-red-600">
                  {(errors as any).endDate?.message as any}
                </p>
              )}
            </div>

            {/* End Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Time <span className="text-red-500">*</span>
              </label>
              <input
                {...register("endTime", {
                  onBlur: async () => {
                    const sDate = (watch() as any).date;
                    const sTime = (watch() as any).time;
                    const eDate = (watch() as any).endDate || sDate;
                    const eTime = (watch() as any).endTime;
                    if (!sDate || !sTime || !eDate || !eTime) return;
                    try {
                      // 1) Point check: is the END time inside any existing event?
                      const pointResult = await eventService.checkTimeConflict({
                        startDate: eDate,
                        startTime: eTime,
                        mode: "point",
                        excludeId: id,
                        timeZone: (watch() as any).timeZone,
                      });
                      if (pointResult.conflict) {
                        setValue(
                          "__endOverlapValidation" as any,
                          {
                            isValid: false,
                            message:
                              "Time overlap: this end time falls within another event. Please choose another.",
                            color: "text-red-500",
                          } as any,
                          { shouldDirty: false, shouldValidate: false }
                        );
                        return;
                      }

                      // 2) Range check: does [start, end] fully wrap or otherwise overlap an existing event?
                      const rangeResult = await eventService.checkTimeConflict({
                        startDate: sDate,
                        startTime: sTime,
                        endDate: eDate,
                        endTime: eTime,
                        mode: "range",
                        excludeId: id,
                        timeZone: (watch() as any).timeZone,
                      });

                      if (rangeResult.conflict) {
                        setValue(
                          "__endOverlapValidation" as any,
                          {
                            isValid: false,
                            message:
                              "Time overlap: this time range overlaps an existing event. Please adjust start or end time.",
                            color: "text-red-500",
                          } as any,
                          { shouldDirty: false, shouldValidate: false }
                        );
                      } else {
                        setValue(
                          "__endOverlapValidation" as any,
                          {
                            isValid: true,
                            message: "",
                            color: "text-green-500",
                          } as any,
                          { shouldDirty: false, shouldValidate: false }
                        );
                      }
                    } catch (e) {
                      setValue(
                        "__endOverlapValidation" as any,
                        {
                          isValid: true,
                          message: "",
                          color: "text-gray-500",
                        } as any,
                        { shouldDirty: false, shouldValidate: false }
                      );
                    }
                  },
                })}
                type="time"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <ValidationIndicator validation={validations.endTime} />
              <ValidationIndicator validation={validations.endOverlap!} />
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
              mainOrganizer={{
                id: (eventData as any)?.createdBy?.id || currentUser.id,
                firstName:
                  (eventData as any)?.createdBy?.firstName ||
                  currentUser.firstName,
                lastName:
                  (eventData as any)?.createdBy?.lastName ||
                  currentUser.lastName,
                systemAuthorizationLevel:
                  (eventData as any)?.createdBy?.role || currentUser.role,
                roleInAtCloud:
                  (eventData as any)?.createdBy?.roleInAtCloud ||
                  currentUser.roleInAtCloud,
                gender:
                  (eventData as any)?.createdBy?.gender || currentUser.gender,
                avatar:
                  (eventData as any)?.createdBy?.avatar ||
                  currentUser.avatar ||
                  null,
                email:
                  (eventData as any)?.createdBy?.email || currentUser.email,
                phone:
                  (eventData as any)?.createdBy?.phone || currentUser.phone,
              }}
              currentUserId={currentUser.id}
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

              {/* Zoom Link (optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Zoom Link
                </label>
                <input
                  {...register("zoomLink")}
                  type="url"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter Zoom meeting link (optional - can be added later)"
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
              disabled={isSubmitting || !isDirty}
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
