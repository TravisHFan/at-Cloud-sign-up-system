import { useState, useEffect, useMemo } from "react";
import { useEventForm } from "../hooks/useEventForm";
import { useEventValidation } from "../hooks/useEventValidation";
import { useRoleValidation } from "../hooks/useRoleValidation";
import EventPreview from "../components/events/EventPreview";
import OrganizerSelection from "../components/events/OrganizerSelection";
import ValidationIndicator from "../components/events/ValidationIndicator";
import { eventService } from "../services/api";
// Fallback constants (used only if API templates fail to load)
import { getRolesByEventType } from "../config/eventRoles";
import { EVENT_TYPES } from "../config/eventConstants";
import { COMMON_TIMEZONES } from "../data/timeZones";
import { useAuth } from "../hooks/useAuth";
import {
  handleDateInputChange,
  getTodayDateString,
} from "../utils/eventStatsUtils";

interface Organizer {
  id: string; // UUID to match User interface
  firstName: string;
  lastName: string;
  systemAuthorizationLevel: string;
  roleInAtCloud?: string;
  gender: "male" | "female";
  avatar: string | null;
  email: string; // Add email field
  phone?: string; // Add phone field
}

export default function NewEvent() {
  const { currentUser } = useAuth();
  const [selectedOrganizers, setSelectedOrganizers] = useState<Organizer[]>([]);
  const [allowedTypes, setAllowedTypes] = useState<string[]>([]);
  const [templates, setTemplates] = useState<
    Record<
      string,
      Array<{ name: string; description: string; maxParticipants: number }>
    >
  >({});
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [templatesError, setTemplatesError] = useState<string | null>(null);

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

  const {
    form,
    isSubmitting,
    showPreview,
    watchAllFields,
    onSubmit,
    togglePreview,
    hidePreview,
  } = useEventForm(organizerDetails);

  // Destructure form helpers before any usage below
  const {
    register,
    formState: { errors },
    watch,
    setValue,
  } = form;

  // Ensure RHF tracks hidden validation fields so updates trigger re-render
  useEffect(() => {
    // Register once
    (register as any)("__startOverlapValidation");
    (register as any)("__endOverlapValidation");
    // Initialize defaults
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

  // (form helpers already destructured above)

  // Add real-time validation
  const { validations, overallStatus, isFormValid } = useEventValidation(watch);

  // Watch the format field to show/hide conditional fields
  const selectedFormat = watch("format");

  // Watch the selected event type to dynamically load roles
  const selectedEventType = watch("type");
  const currentRoles = useMemo(() => {
    if (!selectedEventType) return [];
    const tpl = templates[selectedEventType];
    return Array.isArray(tpl) ? tpl : [];
  }, [selectedEventType, templates]);

  // Watch the form's roles field for validation
  const formRoles = watch("roles") || [];

  // Add role validation for 3x limit warnings
  const { hasWarnings: hasRoleWarnings, warnings: roleWarnings } =
    useRoleValidation(formRoles, templates, selectedEventType);

  // Update form roles when event type changes
  useEffect(() => {
    if (selectedEventType && currentRoles.length > 0) {
      const formattedRoles = currentRoles.map((role, index) => ({
        id: `role-${index}`,
        name: role.name,
        description: role.description,
        maxParticipants: role.maxParticipants,
        currentSignups: [],
      }));
      setValue("roles", formattedRoles);
    }
  }, [selectedEventType, currentRoles, setValue]);

  // Load templates from backend and initialize default type/roles
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingTemplates(true);
        const data = await eventService.getEventTemplates();
        if (!mounted) return;
        setAllowedTypes(data.allowedTypes);
        setTemplates(data.templates);
        // Default to Conference if available
        const defaultEventType = data.allowedTypes.includes("Conference")
          ? "Conference"
          : data.allowedTypes[0];
        if (defaultEventType) {
          setValue("type", defaultEventType);
          const defaultRoles = data.templates[defaultEventType] || [];
          const formattedRoles = defaultRoles.map((role, index) => ({
            id: `role-${index}`,
            name: role.name,
            description: role.description,
            maxParticipants: role.maxParticipants,
            currentSignups: [],
          }));
          setValue("roles", formattedRoles);
        }
      } catch (err: any) {
        console.error("Failed to load event templates:", err);
        setTemplatesError(err?.message || "Failed to load templates");
        // Fallback to local constants to avoid blocking the form in dev/tests
        const fallbackTypes = EVENT_TYPES.map((t) => t.name);
        setAllowedTypes(fallbackTypes);
        const fallbackTemplates: Record<
          string,
          Array<{ name: string; description: string; maxParticipants: number }>
        > = {};
        fallbackTypes.forEach((t) => {
          const roles = getRolesByEventType(t);
          fallbackTemplates[t] = roles as any;
        });
        setTemplates(fallbackTemplates);
        const defaultEventType = fallbackTypes.includes("Conference")
          ? "Conference"
          : fallbackTypes[0];
        if (defaultEventType) {
          setValue("type", defaultEventType);
          const defaultRoles = fallbackTemplates[defaultEventType] || [];
          const formattedRoles = defaultRoles.map((role, index) => ({
            id: `role-${index}`,
            name: role.name,
            description: role.description,
            maxParticipants: role.maxParticipants,
            currentSignups: [],
          }));
          setValue("roles", formattedRoles);
        }
      } finally {
        if (mounted) setLoadingTemplates(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [setValue]);

  // Show preview if requested
  if (showPreview) {
    // Calculate total slots from roles
    const roles = watchAllFields.roles || [];
    const calculatedTotalSlots = roles.reduce((total, role) => {
      return total + (role.maxParticipants || 0);
    }, 0);

    // Convert form data to EventData format for preview
    const previewData = {
      id: watchAllFields.id || "preview",
      ...watchAllFields,
      location: watchAllFields.location || "",
      hostedBy: watchAllFields.hostedBy || "",
      zoomLink: watchAllFields.zoomLink || "",
      meetingId: watchAllFields.meetingId || "",
      passcode: watchAllFields.passcode || "",
      requirements: watchAllFields.requirements || "",
      materials: watchAllFields.materials || "",
      disclaimer: watchAllFields.disclaimer || undefined,
      roles: (watchAllFields.roles || []).map((role) => ({
        ...role,
        currentSignups: role.currentSignups || [],
      })),
      signedUp: watchAllFields.signedUp || 0,
      totalSlots: calculatedTotalSlots || 50, // Use calculated total from roles
      createdBy:
        (watchAllFields as any).createdBy ||
        (currentUser
          ? {
              id: currentUser.id,
              firstName: currentUser.firstName,
              lastName: currentUser.lastName,
              email: currentUser.email,
              roleInAtCloud: currentUser.roleInAtCloud,
              role: currentUser.role,
              avatar: currentUser.avatar || undefined,
              gender: currentUser.gender,
            }
          : ""),
      createdAt: watchAllFields.createdAt || new Date().toISOString(),
      organizerDetails: organizerDetails,
      timeZone: watchAllFields.timeZone,
    };

    return (
      <EventPreview
        eventData={previewData}
        isSubmitting={isSubmitting}
        onEdit={hidePreview}
        onSubmit={onSubmit}
      />
    );
  }

  // Main form render
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Create New Event
        </h1>

        <form onSubmit={onSubmit} className="space-y-6">
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
              disabled={loadingTemplates}
            >
              <option value="">
                {loadingTemplates ? "Loading types..." : "Select event type"}
              </option>
              {allowedTypes.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <ValidationIndicator validation={validations.type} />
            {errors.type && (
              <p className="mt-1 text-sm text-red-600">{errors.type.message}</p>
            )}
            <p className="mt-1 text-sm text-gray-500">
              Select the type of event you want to create.
            </p>
            {templatesError && (
              <p className="mt-1 text-sm text-red-600">{templatesError}</p>
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
              Times will be interpreted in this time zone and shown to viewers
              in their local time.
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
                    setValue("date", normalizedDate);
                    // Default endDate to match start date if unset or equal
                    const currentEnd = (watchAllFields as any).endDate;
                    if (!currentEnd) setValue("endDate", normalizedDate);
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
                          { shouldDirty: true, shouldValidate: false }
                        );
                      } else {
                        setValue(
                          "__startOverlapValidation" as any,
                          {
                            isValid: true,
                            message: "",
                            color: "text-green-500",
                          } as any,
                          { shouldDirty: true, shouldValidate: false }
                        );
                      }
                    } catch (e) {
                      // Network or server error: do not block user; clear message
                      setValue(
                        "__startOverlapValidation" as any,
                        {
                          isValid: true,
                          message: "",
                          color: "text-gray-500",
                        } as any,
                        { shouldDirty: true, shouldValidate: false }
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
                    setValue("endDate", normalizedDate);
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
                    if (!sDate || !sTime || !eTime) return;
                    try {
                      // 1) Point check for END time inside any existing event
                      const pointResult = await eventService.checkTimeConflict({
                        startDate: eDate,
                        startTime: eTime,
                        mode: "point",
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
                          { shouldDirty: true, shouldValidate: false }
                        );
                        return;
                      }

                      // 2) Range check for [start, end] overlapping or wrapping existing event
                      const rangeResult = await eventService.checkTimeConflict({
                        startDate: sDate,
                        startTime: sTime,
                        endDate: eDate,
                        endTime: eTime,
                        mode: "range",
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
                          { shouldDirty: true, shouldValidate: false }
                        );
                      } else {
                        setValue(
                          "__endOverlapValidation" as any,
                          {
                            isValid: true,
                            message: "",
                            color: "text-green-500",
                          } as any,
                          { shouldDirty: true, shouldValidate: false }
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
                        { shouldDirty: true, shouldValidate: false }
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

              {/* Zoom Link */}
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

          {/* Role Configuration Section */}
          {selectedEventType && currentRoles.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Configure Event Roles for {selectedEventType}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Set the number of participants needed for each role. These roles
                will be available for event registration.
              </p>

              <div className="space-y-4">
                {currentRoles.map((role, index) => (
                  <div
                    key={role.name}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{role.name}</h4>
                      <p className="text-sm text-gray-600">
                        {role.description}
                      </p>
                    </div>
                    <div className="ml-4">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-500">
                          Max participants:
                        </span>
                        <input
                          type="number"
                          min="1"
                          max="50"
                          defaultValue={role.maxParticipants}
                          onChange={(e) => {
                            // Update the role in the form roles
                            const currentFormRoles = watch("roles") || [];
                            const updatedFormRoles = [...currentFormRoles];
                            if (updatedFormRoles[index]) {
                              updatedFormRoles[index] = {
                                ...updatedFormRoles[index],
                                maxParticipants:
                                  parseInt(e.target.value) ||
                                  role.maxParticipants,
                              };
                              setValue("roles", updatedFormRoles);
                            }
                          }}
                          className={`w-20 px-2 py-1 border rounded text-center ${
                            roleWarnings[index.toString()]
                              ? "border-orange-500 bg-orange-50"
                              : "border-gray-300"
                          }`}
                        />
                      </div>
                      {roleWarnings[index.toString()] && (
                        <p className="text-xs text-orange-600 mt-1 max-w-xs">
                          {roleWarnings[index.toString()]}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Show message when no event type is selected */}
          {!selectedEventType && (
            <div className="bg-gray-50 rounded-lg p-6 text-center">
              <p className="text-gray-600">
                Please select an event type above to configure roles and see
                role-specific options.
              </p>
            </div>
          )}

          {/* Form Actions */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            {/* Overall Validation Status */}
            <div className="mb-4 border-b pb-4">
              <ValidationIndicator
                validation={overallStatus}
                showWhenEmpty={true}
              />
            </div>

            <div className="flex items-center justify-end gap-4">
              <button
                type="button"
                onClick={togglePreview}
                className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              >
                Preview Event
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !isFormValid || hasRoleWarnings}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-400"
              >
                {isSubmitting ? "Creating..." : "Create Event"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
