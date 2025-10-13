import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import type { ChangeEvent } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { useEventForm } from "../hooks/useEventForm";
import { useEventValidation } from "../hooks/useEventValidation";
import { useRoleValidation } from "../hooks/useRoleValidation";
import EventPreview from "../components/events/EventPreview";
import OrganizerSelection from "../components/events/OrganizerSelection";
import ValidationIndicator from "../components/events/ValidationIndicator";
import {
  eventService,
  fileService,
  programService,
  rolesTemplateService,
} from "../services/api";
// Fallback constants (used only if API templates fail to load)
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

// MentorsPicker component removed - no longer needed with mentorCircle removal

export default function NewEvent() {
  const { currentUser } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  // Get programId from URL and convert to array for programLabels (set via useEffect)
  const programIdFromUrl = searchParams.get("programId");
  const [selectedOrganizers, setSelectedOrganizers] = useState<Organizer[]>([]);
  const [programs, setPrograms] = useState<
    Array<{ id: string; title: string; programType: string }>
  >([]);
  const [programLoading, setProgramLoading] = useState(false);

  // Get recurring event configuration from navigation state
  const recurringConfig = location.state as {
    isRecurring?: boolean;
    frequency?: string | null;
    occurrenceCount?: number | null;
  } | null;
  const [allowedTypes, setAllowedTypes] = useState<string[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [templatesError, setTemplatesError] = useState<string | null>(null);

  // Database role templates
  const [dbTemplates, setDbTemplates] = useState<
    Record<
      string,
      Array<{
        _id: string;
        name: string;
        roles: Array<{
          name: string;
          description: string;
          maxParticipants: number;
          openToPublic?: boolean;
          agenda?: string;
          startTime?: string;
          endTime?: string;
        }>;
      }>
    >
  >({});
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null
  );
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [templateConfirmed, setTemplateConfirmed] = useState(false);

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

  // Create refs for all form fields to enable navigation to first invalid field
  const fieldRefs = useRef<Record<string, HTMLElement | null>>({});

  // Normalize recurrence frequency to allowed union
  type Frequency = "every-two-weeks" | "monthly" | "every-two-months" | null;
  const normalizeFrequency = (value: unknown): Frequency => {
    const allowed = ["every-two-weeks", "monthly", "every-two-months"] as const;
    return typeof value === "string" &&
      (allowed as readonly string[]).includes(value)
      ? (value as Frequency)
      : null;
  };

  // Notification preference: undefined until user selects
  const [sendNotificationsPref, setSendNotificationsPref] = useState<
    boolean | null
  >(null);
  // track if user interacted with notification radios (not needed for error visibility)
  const [, setNotificationPrefTouched] = useState(false);

  const {
    form,
    isSubmitting,
    showPreview,
    watchAllFields,
    onSubmit,
    togglePreview,
    hidePreview,
  } = useEventForm(
    organizerDetails,
    {
      isRecurring: !!recurringConfig?.isRecurring,
      frequency: normalizeFrequency(recurringConfig?.frequency),
      occurrenceCount:
        typeof recurringConfig?.occurrenceCount === "number"
          ? recurringConfig?.occurrenceCount
          : null,
    },
    {
      shouldSendNotifications: () => sendNotificationsPref,
    }
  );

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
    type HiddenValidationField =
      | "__startOverlapValidation"
      | "__endOverlapValidation";
    type ValidationState = {
      isValid: boolean;
      message: string;
      color: string;
    };
    const registerHidden = (name: HiddenValidationField) =>
      (register as unknown as (name: string) => void)(name);
    const setHidden = (name: HiddenValidationField, value: ValidationState) =>
      (
        setValue as unknown as (
          name: string,
          value: ValidationState,
          options?: { shouldDirty?: boolean; shouldValidate?: boolean }
        ) => void
      )(name, value, { shouldDirty: false, shouldValidate: false });

    registerHidden("__startOverlapValidation");
    registerHidden("__endOverlapValidation");
    // Initialize defaults
    setHidden("__startOverlapValidation", {
      isValid: true,
      message: "",
      color: "text-gray-500",
    });
    setHidden("__endOverlapValidation", {
      isValid: true,
      message: "",
      color: "text-gray-500",
    });
  }, [register, setValue]);

  // Initialize organizer field with current user
  useEffect(() => {
    if (!currentUser) return;

    const role = currentUser.roleInAtCloud || currentUser.role;
    const initialOrganizer = `${currentUser.firstName} ${currentUser.lastName} (${role})`;
    setValue("organizer", initialOrganizer);
  }, [setValue, currentUser]);

  // Load programs for selection
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setProgramLoading(true);
        const list = await programService.list();
        if (!cancelled) {
          type ProgramListItem = {
            id?: string;
            _id?: string;
            title: string;
            programType?: string;
          };
          setPrograms(
            (list as ProgramListItem[]).map((p) => ({
              id: p.id || p._id || "",
              title: p.title,
              programType: p.programType || "",
            }))
          );
        }
      } catch (e) {
        console.error("Failed to load programs", e);
      } finally {
        if (!cancelled) setProgramLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Pre-select program from URL parameter (convert to array for programLabels)
  useEffect(() => {
    if (programIdFromUrl && programs.length > 0) {
      // Check if the programId exists in the loaded programs
      const programExists = programs.some((p) => p.id === programIdFromUrl);
      if (programExists) {
        setValue("programLabels", [programIdFromUrl]);
      }
    }
  }, [programIdFromUrl, programs, setValue]);

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

  // Scroll to first invalid field when user clicks on validation summary
  const scrollToFirstInvalidField = useCallback(() => {
    if (!overallStatus.firstInvalidField) return;

    const fieldName = overallStatus.firstInvalidField;
    const element = fieldRefs.current[fieldName];

    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      // Try to focus the input if possible
      if (
        element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement ||
        element instanceof HTMLTextAreaElement
      ) {
        element.focus();
      }
    }
  }, [overallStatus.firstInvalidField]);

  // Watch the format field to show/hide conditional fields
  const selectedFormat = watch("format");
  const selectedProgramLabels = watch("programLabels") as string[] | undefined;
  const selectedEventType = watch("type");

  // Filter event types based on program selection: without a program, hide Mentor Circle and ECW
  const filteredAllowedTypes = useMemo(() => {
    if (!allowedTypes || allowedTypes.length === 0) return [] as string[];
    // If no programs selected
    if (!selectedProgramLabels || selectedProgramLabels.length === 0) {
      return allowedTypes.filter(
        (name) =>
          name !== "Mentor Circle" &&
          name !== "Effective Communication Workshop"
      );
    }
    // Get all selected programs
    const selectedPrograms = programs.filter((p) =>
      selectedProgramLabels.includes(p.id)
    );
    // If ANY selected program is "Effective Communication Workshops", hide Mentor Circle
    const hasECWProgram = selectedPrograms.some(
      (p) => p.programType === "Effective Communication Workshops"
    );
    if (hasECWProgram) {
      return allowedTypes.filter((name) => name !== "Mentor Circle");
    }
    // If ANY selected program is "EMBA Mentor Circles", hide ECW
    const hasMentorCircleProgram = selectedPrograms.some(
      (p) => p.programType === "EMBA Mentor Circles"
    );
    if (hasMentorCircleProgram) {
      return allowedTypes.filter(
        (name) => name !== "Effective Communication Workshop"
      );
    }
    return allowedTypes;
  }, [allowedTypes, selectedProgramLabels, programs]);

  // Ensure currently selected event type remains valid if the list is filtered by program selection
  useEffect(() => {
    if (!selectedEventType) return;
    if (!filteredAllowedTypes.includes(selectedEventType)) {
      const fallback = filteredAllowedTypes[0] || "";
      if (fallback) {
        setValue("type", fallback);
      }
    }
  }, [filteredAllowedTypes, selectedEventType, setValue]);

  // Watch the form's roles field for validation
  const formRoles = watch("roles") || [];
  const [customizeRoles, setCustomizeRoles] = useState(false);

  // Add role validation for 3x limit warnings
  const { warnings: roleWarnings } = useRoleValidation(
    formRoles,
    dbTemplates,
    selectedEventType
  );

  // Load templates from backend and initialize default type/roles
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingTemplates(true);

        // Load only database templates
        const newTemplates = await rolesTemplateService
          .getAllTemplates()
          .catch(() => ({}));

        if (!mounted) return;

        // Use static event types from EVENT_TYPES constant
        const allowedEventTypes = EVENT_TYPES.map((t) => t.name);
        setAllowedTypes(allowedEventTypes);
        setDbTemplates(
          newTemplates as Record<
            string,
            Array<{
              _id: string;
              name: string;
              roles: Array<{
                name: string;
                description: string;
                maxParticipants: number;
                openToPublic?: boolean;
                agenda?: string;
                startTime?: string;
                endTime?: string;
              }>;
            }>
          >
        );

        // Don't auto-select a default event type - let user choose explicitly
        // This prevents showing template selector before user makes a choice
      } catch (err: unknown) {
        console.error("Failed to load event templates:", err);
        setTemplatesError(
          err instanceof Error ? err.message : "Failed to load templates"
        );
        // Fallback to static event types - but don't auto-select any type
        const fallbackTypes = EVENT_TYPES.map((t) => t.name);
        setAllowedTypes(fallbackTypes);
        // Don't auto-select event type even on error - let user choose explicitly
      } finally {
        if (mounted) setLoadingTemplates(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [setValue]);

  // Handle template selection when event type changes
  useEffect(() => {
    if (!selectedEventType) return;

    // Check database templates for this event type
    const dbTemplatesForType = dbTemplates[selectedEventType] || [];

    if (dbTemplatesForType.length === 1) {
      // Auto-apply single template
      const template = dbTemplatesForType[0];
      const formattedRoles = template.roles.map((role, index: number) => ({
        id: `role-${index}`,
        name: role.name,
        description: role.description,
        maxParticipants: role.maxParticipants,
        currentSignups: [],
        openToPublic: role.openToPublic,
        agenda: role.agenda,
        startTime: role.startTime,
        endTime: role.endTime,
      }));
      setValue("roles", formattedRoles);
      setSelectedTemplateId(template._id);
      setTemplateConfirmed(true);
      setShowTemplateSelector(false);
    } else if (dbTemplatesForType.length > 1) {
      // Multiple templates - show selector, clear old roles
      setValue("roles", []); // Clear old roles from previous event type
      setShowTemplateSelector(true);
      setTemplateConfirmed(false);
      setSelectedTemplateId(null);
    } else {
      // No database templates - start with empty roles list
      setValue("roles", []);
      setShowTemplateSelector(false);
      setTemplateConfirmed(true);
    }
  }, [selectedEventType, dbTemplates, setValue]);

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
      // Filter out any undefined values from programLabels
      programLabels: watchAllFields.programLabels?.filter(
        (label): label is string => typeof label === "string"
      ),
      roles: (watchAllFields.roles || []).map((role) => ({
        ...role,
        currentSignups: role.currentSignups || [],
      })),
      signedUp: watchAllFields.signedUp || 0,
      totalSlots: calculatedTotalSlots || 50, // Use calculated total from roles
      createdBy:
        watchAllFields.createdBy ||
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

  // Check if user needs the restricted access overlay (Participant or Guest Expert)
  const shouldShowRestrictedOverlay =
    currentUser?.role === "Participant" || currentUser?.role === "Guest Expert";

  // Main form render
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div
        className={`relative bg-white rounded-lg shadow-sm p-6 ${
          shouldShowRestrictedOverlay ? "bg-gray-50" : ""
        }`}
      >
        {shouldShowRestrictedOverlay && (
          <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[1px] rounded-lg flex flex-col items-center justify-center text-center p-6">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 max-w-md mx-auto">
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mb-4 mx-auto">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Create Event access requires @Cloud Co‑worker authorization
              </h2>
              <p className="text-sm text-gray-600">
                To create new events, you'll need elevated permissions. Please
                contact your @Cloud Leaders to request access.
              </p>
            </div>
          </div>
        )}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {recurringConfig?.isRecurring
            ? "Create the First Event for This Recurring Program"
            : "Create New Event"}
        </h1>

        {recurringConfig?.isRecurring && (
          <p className="text-sm text-gray-500 mb-6">
            Future events will be generated according to the selected recurrence
            (frequency and total count, incl. the first) on the same day of the
            week (Monday–Sunday) each cycle. All generated events are
            individually editable.
          </p>
        )}

        <form onSubmit={onSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Event Title <span className="text-red-500">*</span>
            </label>
            <input
              id="title"
              {...register("title")}
              ref={(el) => {
                register("title").ref(el);
                fieldRefs.current.title = el;
              }}
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

          {/* Program Labels (optional multi-select) */}
          <div>
            <label
              htmlFor="programLabels"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Programs (Optional)
            </label>
            <select
              id="programLabels"
              {...register("programLabels")}
              multiple
              size={Math.min(programs.length + 1, 5)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={programLoading}
            >
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Hold Cmd/Ctrl to select multiple programs. Leave unselected for
              events not part of any program.
            </p>
          </div>

          {/* Event Type - Dropdown selection */}

          <div>
            <label
              htmlFor="type"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Event Type <span className="text-red-500">*</span>
            </label>
            <select
              id="type"
              {...register("type")}
              ref={(el) => {
                register("type").ref(el);
                fieldRefs.current.type = el;
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loadingTemplates}
            >
              {!selectedEventType && (
                <option value="">
                  {loadingTemplates
                    ? "Loading types..."
                    : "-- Select event type --"}
                </option>
              )}
              {filteredAllowedTypes.map((name) => (
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
            <label
              htmlFor="timeZone"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Time Zone <span className="text-red-500">*</span>
            </label>
            <select
              id="timeZone"
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
              <label
                htmlFor="date"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Start Date <span className="text-red-500">*</span>
              </label>
              <input
                id="date"
                {...register("date", {
                  onChange: (e: ChangeEvent<HTMLInputElement>) => {
                    const normalizedDate = handleDateInputChange(
                      e.target.value
                    );
                    setValue("date", normalizedDate);
                    // Default endDate to match start date if unset or equal
                    const currentEnd = watchAllFields.endDate;
                    if (!currentEnd) setValue("endDate", normalizedDate);
                  },
                })}
                ref={(el) => {
                  register("date").ref(el);
                  fieldRefs.current.date = el;
                }}
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
              <label
                htmlFor="time"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Start Time <span className="text-red-500">*</span>
              </label>
              <input
                id="time"
                {...register("time", {
                  onBlur: async () => {
                    const sDate = watch("date");
                    const sTime = watch("time");
                    if (!sDate || !sTime) return;
                    try {
                      const result = await eventService.checkTimeConflict({
                        startDate: sDate,
                        startTime: sTime,
                        mode: "point",
                        timeZone: watch("timeZone"),
                      });
                      if (result.conflict) {
                        (
                          setValue as unknown as (
                            name: string,
                            value: {
                              isValid: boolean;
                              message: string;
                              color: string;
                            },
                            options?: {
                              shouldDirty?: boolean;
                              shouldValidate?: boolean;
                            }
                          ) => void
                        )(
                          "__startOverlapValidation",
                          {
                            isValid: false,
                            message:
                              "Time overlap: this start time falls within another event. Please choose another.",
                            color: "text-red-500",
                          },
                          { shouldDirty: true, shouldValidate: false }
                        );
                      } else {
                        (
                          setValue as unknown as (
                            name: string,
                            value: {
                              isValid: boolean;
                              message: string;
                              color: string;
                            },
                            options?: {
                              shouldDirty?: boolean;
                              shouldValidate?: boolean;
                            }
                          ) => void
                        )(
                          "__startOverlapValidation",
                          {
                            isValid: true,
                            message: "",
                            color: "text-green-500",
                          },
                          { shouldDirty: true, shouldValidate: false }
                        );
                      }
                    } catch {
                      // Network or server error: do not block user; clear message
                      (
                        setValue as unknown as (
                          name: string,
                          value: {
                            isValid: boolean;
                            message: string;
                            color: string;
                          },
                          options?: {
                            shouldDirty?: boolean;
                            shouldValidate?: boolean;
                          }
                        ) => void
                      )(
                        "__startOverlapValidation",
                        { isValid: true, message: "", color: "text-gray-500" },
                        { shouldDirty: true, shouldValidate: false }
                      );
                    }
                  },
                })}
                ref={(el) => {
                  register("time").ref(el);
                  fieldRefs.current.time = el;
                }}
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
              <label
                htmlFor="endDate"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                End Date <span className="text-red-500">*</span>
              </label>
              <input
                id="endDate"
                {...register("endDate", {
                  onChange: (e: ChangeEvent<HTMLInputElement>) => {
                    const normalizedDate = handleDateInputChange(
                      e.target.value
                    );
                    setValue("endDate", normalizedDate);
                  },
                })}
                ref={(el) => {
                  register("endDate").ref(el);
                  fieldRefs.current.endDate = el;
                }}
                type="date"
                min={getTodayDateString()}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <ValidationIndicator validation={validations.endDate} />
              {errors.endDate && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.endDate.message}
                </p>
              )}
            </div>

            {/* End Time */}
            <div>
              <label
                htmlFor="endTime"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                End Time <span className="text-red-500">*</span>
              </label>
              <input
                id="endTime"
                {...register("endTime", {
                  onBlur: async () => {
                    const sDate = watch("date");
                    const sTime = watch("time");
                    const eDate = watch("endDate") || sDate;
                    const eTime = watch("endTime");
                    if (!sDate || !sTime || !eTime) return;
                    try {
                      // 1) Point check for END time inside any existing event
                      const pointResult = await eventService.checkTimeConflict({
                        startDate: eDate,
                        startTime: eTime,
                        mode: "point",
                        timeZone: watch("timeZone"),
                      });
                      if (pointResult.conflict) {
                        (
                          setValue as unknown as (
                            name: string,
                            value: {
                              isValid: boolean;
                              message: string;
                              color: string;
                            },
                            options?: {
                              shouldDirty?: boolean;
                              shouldValidate?: boolean;
                            }
                          ) => void
                        )(
                          "__endOverlapValidation",
                          {
                            isValid: false,
                            message:
                              "Time overlap: this end time falls within another event. Please choose another.",
                            color: "text-red-500",
                          },
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
                        timeZone: watch("timeZone"),
                      });

                      if (rangeResult.conflict) {
                        (
                          setValue as unknown as (
                            name: string,
                            value: {
                              isValid: boolean;
                              message: string;
                              color: string;
                            },
                            options?: {
                              shouldDirty?: boolean;
                              shouldValidate?: boolean;
                            }
                          ) => void
                        )(
                          "__endOverlapValidation",
                          {
                            isValid: false,
                            message:
                              "Time overlap: this time range overlaps an existing event. Please adjust start or end time.",
                            color: "text-red-500",
                          },
                          { shouldDirty: true, shouldValidate: false }
                        );
                      } else {
                        (
                          setValue as unknown as (
                            name: string,
                            value: {
                              isValid: boolean;
                              message: string;
                              color: string;
                            },
                            options?: {
                              shouldDirty?: boolean;
                              shouldValidate?: boolean;
                            }
                          ) => void
                        )(
                          "__endOverlapValidation",
                          {
                            isValid: true,
                            message: "",
                            color: "text-green-500",
                          },
                          { shouldDirty: true, shouldValidate: false }
                        );
                      }
                    } catch {
                      (
                        setValue as unknown as (
                          name: string,
                          value: {
                            isValid: boolean;
                            message: string;
                            color: string;
                          },
                          options?: {
                            shouldDirty?: boolean;
                            shouldValidate?: boolean;
                          }
                        ) => void
                      )(
                        "__endOverlapValidation",
                        { isValid: true, message: "", color: "text-gray-500" },
                        { shouldDirty: true, shouldValidate: false }
                      );
                    }
                  },
                })}
                ref={(el) => {
                  register("endTime").ref(el);
                  fieldRefs.current.endTime = el;
                }}
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
            <label
              htmlFor="hostedBy"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Hosted by
            </label>
            <input
              id="hostedBy"
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

          {/* Purpose (optional) */}
          <div>
            <label
              htmlFor="purpose"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Purpose
            </label>
            <p className="text-xs text-blue-600 mb-2">
              Suggested: This shows as a bold tagline / intro paragraph on the
              public event page once published. Keep it concise and compelling.
            </p>
            <textarea
              id="purpose"
              {...register("purpose")}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Describe the purpose of this event (optional)"
            />
            {/* Purpose is optional; no validation error UI needed */}
          </div>

          {/* Event Flyer (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Event Flyer
            </label>
            <div className="flex items-center gap-3">
              <input
                type="url"
                {...register("flyerUrl")}
                placeholder="https://... or /uploads/images/your-file.png"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <label
                className="px-3 py-2 border rounded-md cursor-pointer hover:bg-gray-50"
                title="Upload image"
              >
                📎
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const inputEl = e.currentTarget;
                    const file = inputEl.files?.[0];
                    if (!file) return;
                    try {
                      const { url } = await fileService.uploadImage(file);
                      setValue("flyerUrl", url, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    } catch (err) {
                      console.error("Flyer upload failed", err);
                      alert("Failed to upload image");
                    } finally {
                      inputEl.value = "";
                    }
                  }}
                />
              </label>
            </div>
            {watch("flyerUrl") && (
              <div className="mt-3">
                <img
                  src={watch("flyerUrl")}
                  alt="Event flyer preview"
                  className="w-full max-w-2xl h-auto rounded border border-gray-200 object-contain"
                />
              </div>
            )}
          </div>

          {/* Event Agenda and Schedule */}
          <div>
            <label
              htmlFor="agenda"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Event Agenda and Schedule <span className="text-red-500">*</span>
            </label>
            <textarea
              id="agenda"
              {...register("agenda")}
              ref={(el) => {
                register("agenda").ref(el);
                fieldRefs.current.agenda = el;
              }}
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
            <label
              htmlFor="format"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Format <span className="text-red-500">*</span>
            </label>
            <select
              id="format"
              {...register("format")}
              ref={(el) => {
                register("format").ref(el);
                fieldRefs.current.format = el;
              }}
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
              <label
                htmlFor="location"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Location <span className="text-red-500">*</span>
              </label>
              <input
                id="location"
                {...register("location")}
                ref={(el) => {
                  register("location").ref(el);
                  fieldRefs.current.location = el;
                }}
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
                <label
                  htmlFor="zoomLink"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Zoom Link
                </label>
                <input
                  id="zoomLink"
                  {...register("zoomLink")}
                  ref={(el) => {
                    register("zoomLink").ref(el);
                    fieldRefs.current.zoomLink = el;
                  }}
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
                <label
                  htmlFor="meetingId"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Meeting ID
                </label>
                <input
                  id="meetingId"
                  {...register("meetingId")}
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter Meeting ID (optional)"
                />
              </div>

              {/* Passcode */}
              <div>
                <label
                  htmlFor="passcode"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Passcode
                </label>
                <input
                  id="passcode"
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
            <label
              htmlFor="disclaimer"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Disclaimer Terms
            </label>
            <textarea
              id="disclaimer"
              {...register("disclaimer")}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter disclaimer terms and conditions (optional)"
            />
            {errors.disclaimer && (
              <p className="mt-1 text-sm text-red-600">
                {errors.disclaimer.message}
              </p>
            )}
          </div>

          {/* Template Selector UI (when multiple templates available) - show BEFORE role configuration */}
          {selectedEventType && showTemplateSelector && !templateConfirmed && (
            <div className="mb-6 p-4 border border-blue-200 bg-blue-50 rounded-md">
              <h4 className="text-sm font-semibold text-gray-900 mb-2">
                Choose a Roles Template
              </h4>
              <p className="text-xs text-gray-600 mb-3">
                Multiple role templates are available for this event type.
                Select one to get started.
              </p>
              <div className="mb-3">
                <select
                  value={selectedTemplateId || ""}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                    setSelectedTemplateId(e.target.value || null);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {!selectedTemplateId && (
                    <option value="">-- Select a template --</option>
                  )}
                  {(dbTemplates[selectedEventType] || []).map((template) => (
                    <option key={template._id} value={template._id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedTemplateId) {
                      alert("Please select a template first");
                      return;
                    }
                    // Apply the selected template
                    const template = (
                      dbTemplates[selectedEventType] || []
                    ).find((t) => t._id === selectedTemplateId);
                    if (template) {
                      const formattedRoles = template.roles.map(
                        (role, index: number) => ({
                          id: `role-${index}`,
                          name: role.name,
                          description: role.description,
                          maxParticipants: role.maxParticipants,
                          currentSignups: [],
                          openToPublic: role.openToPublic,
                          agenda: role.agenda,
                          startTime: role.startTime,
                          endTime: role.endTime,
                        })
                      );
                      setValue("roles", formattedRoles);
                      setTemplateConfirmed(true);
                      setShowTemplateSelector(false);
                    }
                  }}
                  disabled={!selectedTemplateId}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirm Template
                </button>
                <button
                  type="button"
                  onClick={() => {
                    window.location.href =
                      "/dashboard/configure-roles-templates";
                  }}
                  className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                >
                  Configure Templates
                </button>
              </div>

              {/* Preview selected template's roles */}
              {selectedTemplateId &&
                (() => {
                  const template = (dbTemplates[selectedEventType] || []).find(
                    (t) => t._id === selectedTemplateId
                  );
                  if (!template) return null;

                  return (
                    <div className="mt-4 p-4 bg-gray-50 border-2 border-dashed border-gray-300 rounded-md opacity-75">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="px-2 py-1 text-xs font-semibold bg-gray-200 text-gray-700 rounded uppercase">
                          Preview
                        </span>
                        <p className="text-xs text-gray-600">
                          This template includes {template.roles.length} role
                          {template.roles.length !== 1 ? "s" : ""}:
                        </p>
                      </div>
                      <div className="space-y-2">
                        {template.roles.map((role, idx: number) => (
                          <div
                            key={idx}
                            className="p-3 bg-white border border-gray-200 rounded"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <h5 className="font-semibold text-sm text-gray-800">
                                  {role.name}
                                </h5>
                                <p className="text-xs text-gray-600 mt-1">
                                  {role.description}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-gray-500">
                                  Max Participants
                                </p>
                                <p className="text-sm font-semibold text-gray-800">
                                  {role.maxParticipants}
                                </p>
                              </div>
                            </div>
                            {role.openToPublic !== undefined && (
                              <div className="mt-2 flex items-center gap-1">
                                <span className="text-xs text-gray-500">
                                  {role.openToPublic
                                    ? "🌐 Open to public"
                                    : "🔒 Members only"}
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              {selectedTemplateId && (
                <div className="mt-3 flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-300 rounded-md p-3">
                  <svg
                    className="w-4 h-4 flex-shrink-0 mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 16 16"
                  >
                    <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
                    <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z" />
                  </svg>
                  <p>
                    After confirming this template, you can't switch to another
                    template of the same type. However, you can still customize
                    the roles for this event based on this role template.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Role Configuration Section */}
          {selectedEventType && formRoles.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Configure Event Roles for {selectedEventType}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Set the number of participants needed for each role. These roles
                will be available for event registration.
              </p>

              {/* Configure Templates Link - shown when template is confirmed */}
              {templateConfirmed && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-700">
                      {/* Show success message only for single-template event types (auto-applied) */}
                      {selectedEventType &&
                        (dbTemplates[selectedEventType] || []).length === 1 && (
                          <p className="text-xs text-green-600 mb-1">
                            ✓ Template applied successfully
                          </p>
                        )}
                      <p className="font-medium mb-1">Role Templates</p>
                      <p className="text-xs text-gray-600">
                        Want to manage role templates for future events?
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        window.location.href =
                          "/dashboard/configure-roles-templates";
                      }}
                      className="px-4 py-2 text-sm bg-white border border-blue-300 text-blue-700 rounded-md hover:bg-blue-50 hover:border-blue-400 transition-colors"
                    >
                      Configure Templates
                    </button>
                  </div>
                </div>
              )}

              {/* Customize Roles Toggle */}
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="text-sm text-gray-600">
                  <p className="mb-1 font-medium">Customize Roles</p>
                  <p className="text-xs">
                    Changes apply to this event only and won’t affect the event
                    type template.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCustomizeRoles((v) => !v)}
                  className="px-3 py-2 text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50"
                >
                  {customizeRoles ? "Done" : "Customize Roles"}
                </button>
              </div>

              <div className="space-y-4">
                {customizeRoles && formRoles.length > 0 && (
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        const newRole = {
                          id: `role-${Date.now()}`,
                          name: "New Role",
                          description: "Describe this role",
                          maxParticipants: 1,
                          currentSignups: [],
                        };
                        setValue("roles", [newRole, ...formRoles]);
                      }}
                      className="px-3 py-2 text-sm rounded-md border border-dashed border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-blue-400 hover:text-blue-700 transition-colors"
                    >
                      + Add Role Here
                    </button>
                  </div>
                )}
                {formRoles.map((role, index) => (
                  <React.Fragment key={`${role.id || role.name}-${index}`}>
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between mb-4 gap-3">
                        <div className="flex-1 space-y-2">
                          {customizeRoles ? (
                            <>
                              <input
                                type="text"
                                aria-label={`Role name ${index + 1}`}
                                value={formRoles[index]?.name || ""}
                                onChange={(
                                  e: ChangeEvent<HTMLInputElement>
                                ) => {
                                  const updated = [...formRoles];
                                  if (updated[index]) {
                                    updated[index] = {
                                      ...updated[index],
                                      name: e.target.value,
                                    } as typeof role;
                                    setValue("roles", updated);
                                  }
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md font-medium text-gray-900"
                              />
                            </>
                          ) : (
                            <>
                              <h4 className="font-medium text-gray-900">
                                {role.name}
                              </h4>
                            </>
                          )}
                        </div>

                        {customizeRoles && (
                          <div className="flex flex-col items-end gap-2 min-w-[150px]">
                            <div className="flex gap-2">
                              <button
                                type="button"
                                aria-label={`Move role ${index + 1} up`}
                                disabled={index === 0}
                                onClick={() => {
                                  if (index === 0) return;
                                  const updated = [...formRoles];
                                  const tmp = updated[index - 1];
                                  updated[index - 1] = updated[index];
                                  updated[index] = tmp;
                                  setValue("roles", updated);
                                }}
                                className="px-2 py-1 text-xs rounded border border-gray-300 disabled:opacity-50"
                              >
                                ↑ Move Up
                              </button>
                              <button
                                type="button"
                                aria-label={`Move role ${index + 1} down`}
                                disabled={index === formRoles.length - 1}
                                onClick={() => {
                                  if (index === formRoles.length - 1) return;
                                  const updated = [...formRoles];
                                  const tmp = updated[index + 1];
                                  updated[index + 1] = updated[index];
                                  updated[index] = tmp;
                                  setValue("roles", updated);
                                }}
                                className="px-2 py-1 text-xs rounded border border-gray-300 disabled:opacity-50"
                              >
                                ↓ Move Down
                              </button>
                            </div>
                            <button
                              type="button"
                              aria-label={`Remove role ${index + 1}`}
                              onClick={() => {
                                const updated = [...formRoles];
                                updated.splice(index, 1);
                                setValue("roles", updated);
                              }}
                              className="px-2 py-1 text-xs rounded border border-red-300 text-red-600 hover:bg-red-50"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Role Configuration Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Role Agenda */}
                        <div className="space-y-3">
                          <h5 className="text-sm font-medium text-gray-700">
                            Agenda
                          </h5>
                          <textarea
                            value={formRoles[index]?.agenda || ""}
                            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
                              const currentFormRoles = watch("roles") || [];
                              const updatedFormRoles = [...currentFormRoles];
                              if (updatedFormRoles[index]) {
                                updatedFormRoles[index] = {
                                  ...updatedFormRoles[index],
                                  agenda: e.target.value || undefined,
                                };
                                setValue("roles", updatedFormRoles);
                              }
                            }}
                            placeholder="Add role timing for this role..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm min-h-[80px] resize-vertical"
                            rows={3}
                          />
                        </div>

                        {/* Role Description */}
                        <div className="space-y-3">
                          <h5 className="text-sm font-medium text-gray-700">
                            Description
                          </h5>
                          {customizeRoles ? (
                            <textarea
                              aria-label={`Role description ${index + 1}`}
                              value={formRoles[index]?.description || ""}
                              onChange={(
                                e: ChangeEvent<HTMLTextAreaElement>
                              ) => {
                                const currentFormRoles = watch("roles") || [];
                                const updatedFormRoles = [...currentFormRoles];
                                if (updatedFormRoles[index]) {
                                  updatedFormRoles[index] = {
                                    ...updatedFormRoles[index],
                                    description: e.target.value,
                                  } as typeof role;
                                  setValue("roles", updatedFormRoles);
                                }
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm whitespace-pre-line min-h-[80px] resize-vertical"
                              rows={3}
                            />
                          ) : (
                            <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded whitespace-pre-line">
                              {formRoles[index]?.description}
                            </div>
                          )}
                        </div>

                        {/* Max Participants */}
                        <div className="space-y-3">
                          <h5 className="text-sm font-medium text-gray-700">
                            Capacity
                          </h5>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-500">
                              Max participants:
                            </span>
                            <input
                              type="number"
                              min="1"
                              aria-label={`Max participants for ${
                                formRoles[index]?.name || `role ${index + 1}`
                              }`}
                              defaultValue={
                                formRoles[index]?.maxParticipants || 1
                              }
                              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                // Update the role in the form roles
                                const currentFormRoles = watch("roles") || [];
                                const updatedFormRoles = [...currentFormRoles];
                                if (updatedFormRoles[index]) {
                                  updatedFormRoles[index] = {
                                    ...updatedFormRoles[index],
                                    maxParticipants:
                                      parseInt(e.target.value) ||
                                      formRoles[index]?.maxParticipants ||
                                      1,
                                  } as typeof role;
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
                            <p className="text-xs text-orange-600 mt-1">
                              {roleWarnings[index.toString()]}
                            </p>
                          )}
                        </div>

                        {/* Open to Public Toggle */}
                        <div className="space-y-3">
                          <h5 className="text-sm font-medium text-gray-700">
                            Public Access
                          </h5>
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={
                                (formRoles[index] as { openToPublic?: boolean })
                                  ?.openToPublic || false
                              }
                              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                const currentFormRoles = watch("roles") || [];
                                const updatedFormRoles = [...currentFormRoles];
                                if (updatedFormRoles[index]) {
                                  updatedFormRoles[index] = {
                                    ...updatedFormRoles[index],
                                    openToPublic: e.target.checked,
                                  } as typeof role;
                                  setValue("roles", updatedFormRoles);
                                }
                              }}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-600">
                              Open to public registration
                            </span>
                          </label>
                          <p className="text-xs text-gray-500">
                            When enabled, this role will be available for public
                            sign-up when the event is published
                          </p>
                        </div>
                      </div>
                    </div>
                    {customizeRoles && (
                      <div className="flex justify-center py-2">
                        <button
                          type="button"
                          onClick={() => {
                            const newRole = {
                              id: `role-${Date.now()}`,
                              name: "New Role",
                              description: "Describe this role",
                              maxParticipants: 1,
                              currentSignups: [],
                            };
                            const updated = [...formRoles];
                            updated.splice(index + 1, 0, newRole);
                            setValue("roles", updated);
                          }}
                          className="px-3 py-2 text-sm rounded-md border border-dashed border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-blue-400 hover:text-blue-700 transition-colors"
                        >
                          + Add Role Here
                        </button>
                      </div>
                    )}
                  </React.Fragment>
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

          {/* Show message when event type is selected but no templates available */}
          {selectedEventType && formRoles.length === 0 && templateConfirmed && (
            <div className="mb-6 p-4 border border-blue-200 bg-blue-50 rounded-md">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <svg
                    className="w-5 h-5 text-blue-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-gray-900 mb-1">
                    No template available for this event type
                  </h4>
                  <p className="text-xs text-gray-600 mb-3">
                    You can create roles manually for this event or configure
                    templates for future use.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const newRole = {
                          id: `role-${Date.now()}`,
                          name: "New Role",
                          description: "Describe this role",
                          maxParticipants: 1,
                          currentSignups: [],
                        };
                        setValue("roles", [newRole]);
                      }}
                      className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      Add Role Manually
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        window.location.href =
                          "/dashboard/configure-roles-templates";
                      }}
                      className="px-4 py-2 text-sm bg-white border border-blue-300 text-blue-700 rounded-md hover:bg-blue-50"
                    >
                      Configure Templates
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            {/* Overall Validation Status */}
            <div className="mb-4 border-b pb-4">
              <ValidationIndicator
                validation={overallStatus}
                showWhenEmpty={true}
                onClick={scrollToFirstInvalidField}
              />
            </div>

            {/* Notification preference (required) */}
            <div className="mb-6">
              <fieldset>
                <legend className="block text-sm font-medium text-gray-700 mb-1">
                  Send notifications for this event?{" "}
                  <span className="text-red-500">*</span>
                </legend>
                <p className="text-xs text-gray-500 mb-2">
                  Choose whether to notify all users now via email and a system
                  message.
                </p>
                <div className="space-y-2">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="notifyPref"
                      value="send"
                      checked={sendNotificationsPref === true}
                      onChange={() => {
                        setSendNotificationsPref(true);
                        setNotificationPrefTouched(true);
                      }}
                      className="mt-1"
                    />
                    <span className="text-sm text-gray-700">
                      <span className="font-medium">
                        Send notifications now
                      </span>{" "}
                      (email + system message).
                    </span>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="notifyPref"
                      value="later"
                      checked={sendNotificationsPref === false}
                      onChange={() => {
                        setSendNotificationsPref(false);
                        setNotificationPrefTouched(true);
                      }}
                      className="mt-1"
                    />
                    <span className="text-sm text-gray-700">
                      <span className="font-medium">
                        Don’t send notifications now
                      </span>{" "}
                      — I’ll notify users later.
                    </span>
                  </label>
                </div>
                {sendNotificationsPref === null && (
                  <p className="mt-2 text-sm text-red-600">
                    Select a notification option is required.
                  </p>
                )}
              </fieldset>
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
                disabled={
                  isSubmitting || !isFormValid || sendNotificationsPref === null
                }
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
