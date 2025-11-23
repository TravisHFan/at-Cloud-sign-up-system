import { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { useEventForm } from "../hooks/useEventForm";
import { useEventValidation } from "../hooks/useEventValidation";
import { useRoleValidation } from "../hooks/useRoleValidation";
import EventPreview from "../components/events/EventPreview";
import BasicEventFields from "../components/EditEvent/BasicEventFields";
import FormatSettings from "../components/EditEvent/FormatSettings";
import RoleManagement from "../components/EditEvent/RoleManagement";
import ValidationIndicator from "../components/events/ValidationIndicator";
import ConfirmationModal from "../components/common/ConfirmationModal";
import TemplateSelectorModal from "../components/common/TemplateSelectorModal";
import {
  programService,
  purchaseService,
  roleTemplateService,
} from "../services/api";
// Fallback constants (used only if API templates fail to load)
import { EVENT_TYPES } from "../config/eventConstants";
import { useAuth } from "../hooks/useAuth";
import { useToastReplacement } from "../contexts/NotificationModalContext";

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
  const notification = useToastReplacement();
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
  const [_templateConfirmed, setTemplateConfirmed] = useState(false);
  const [highlightTemplateSelector, setHighlightTemplateSelector] =
    useState(false);
  const [_templateApplied, setTemplateApplied] = useState(false);
  const [highlightRoleSection, setHighlightRoleSection] = useState(false);

  // Modal states for template confirmation and selection
  const [confirmResetModal, setConfirmResetModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: "", message: "", onConfirm: () => {} });
  const [templateSelectorModal, setTemplateSelectorModal] = useState(false);

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
            isFree?: boolean;
            mentors?: Array<{ userId: string }>;
          };

          let filteredList = (list as ProgramListItem[]).map((p) => ({
            id: p.id || p._id || "",
            title: p.title,
            programType: p.programType || "",
            isFree: p.isFree,
            mentors: p.mentors,
          }));

          // FOR LEADER USERS: Filter programs to only show accessible ones
          // (free programs, purchased programs, or programs where they are a mentor)
          if (currentUser?.role === "Leader") {
            const accessiblePrograms: typeof filteredList = [];

            for (const program of filteredList) {
              // Check 1: Is program free?
              if (program.isFree === true) {
                accessiblePrograms.push(program);
                continue;
              }

              // Check 2: Is user a mentor of this program?
              const isMentor = program.mentors?.some(
                (m) => m.userId === currentUser.id
              );
              if (isMentor) {
                accessiblePrograms.push(program);
                continue;
              }

              // Check 3: Has user purchased this program?
              try {
                const accessResult = await purchaseService.checkProgramAccess(
                  program.id
                );
                if (accessResult.hasAccess) {
                  accessiblePrograms.push(program);
                }
              } catch (error) {
                console.error(
                  `Error checking access for program ${program.id}:`,
                  error
                );
                // On error, exclude the program to be safe
              }
            }

            filteredList = accessiblePrograms;
          }

          setPrograms(
            filteredList.map((p) => ({
              id: p.id,
              title: p.title,
              programType: p.programType,
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
  }, [currentUser]);

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

    // Try to find the element by ID or name
    let element = document.getElementById(fieldName);

    // If not found by ID, try finding by name attribute
    if (!element) {
      element = document.querySelector(`[name="${fieldName}"]`) as HTMLElement;
    }

    // If still not found, try common field mappings
    if (!element) {
      const fieldMappings: Record<string, string> = {
        title: "title",
        type: "type",
        date: "date",
        time: "time",
        endDate: "endDate",
        endTime: "endTime",
        timeZone: "timeZone",
        format: "format",
        location: "location",
        zoomLink: "zoomLink",
        agenda: "agenda",
      };

      const mappedId = fieldMappings[fieldName];
      if (mappedId) {
        element = document.getElementById(mappedId);
      }
    }

    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      // Try to focus the input if possible
      setTimeout(() => {
        if (
          element instanceof HTMLInputElement ||
          element instanceof HTMLSelectElement ||
          element instanceof HTMLTextAreaElement
        ) {
          element.focus();
        }
      }, 300); // Wait for scroll animation
    }
  }, [overallStatus.firstInvalidField]);

  const selectedProgramLabels = watch("programLabels") as string[] | undefined;
  const selectedEventType = watch("type");

  // Filter event types based on program selection
  // Base event types (available with no programs): Conference, Webinar
  // EMBA Mentor Circles program adds: Mentor Circle
  // Effective Communication Workshops program adds: Effective Communication Workshop
  const filteredAllowedTypes = useMemo(() => {
    if (!allowedTypes || allowedTypes.length === 0) return [] as string[];

    // Start with base event types: Conference, Webinar
    const baseTypes = ["Conference", "Webinar"];
    const availableTypes = new Set(baseTypes);

    // If programs are selected, add event types based on program types
    if (selectedProgramLabels && selectedProgramLabels.length > 0) {
      const selectedPrograms = programs.filter((p) =>
        selectedProgramLabels.includes(p.id)
      );

      // Check if any EMBA Mentor Circles program is selected
      const hasEMBAProgram = selectedPrograms.some(
        (p) => p.programType === "EMBA Mentor Circles"
      );
      if (hasEMBAProgram) {
        availableTypes.add("Mentor Circle");
      }

      // Check if any Effective Communication Workshops program is selected
      const hasECWProgram = selectedPrograms.some(
        (p) => p.programType === "Effective Communication Workshops"
      );
      if (hasECWProgram) {
        availableTypes.add("Effective Communication Workshop");
      }
    }

    // Filter allowedTypes to only include available types
    return allowedTypes.filter((name) => availableTypes.has(name));
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

  // Create roleValidation object for RoleManagement component
  const roleValidation = {
    hasWarnings: Object.keys(roleWarnings).length > 0,
    warnings: roleWarnings,
  };

  // Load templates from backend and initialize default type/roles
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Load only database templates
        const newTemplates = await roleTemplateService
          .getAllRolesTemplates()
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
        // Fallback to static event types - but don't auto-select any type
        const fallbackTypes = EVENT_TYPES.map((t) => t.name);
        setAllowedTypes(fallbackTypes);
        // Don't auto-select event type even on error - let user choose explicitly
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

    if (dbTemplatesForType.length > 0) {
      // Show template selector for any number of templates (1 or more)
      // Clear old roles from previous event type
      setValue("roles", []);
      setShowTemplateSelector(true);
      setTemplateConfirmed(false);
      setSelectedTemplateId(null);
    } else {
      // No database templates - start with one empty role and show role configuration
      setValue("roles", [
        {
          id: `role-${Date.now()}`,
          name: "New Role",
          description: "Describe this role",
          agenda: "",
          maxParticipants: 1,
          currentSignups: [],
        },
      ]);
      setShowTemplateSelector(false);
      setTemplateConfirmed(true);
      setCustomizeRoles(true); // Auto-expand role configuration section
    }
  }, [selectedEventType, dbTemplates, setValue, setCustomizeRoles]);

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
          {/* Basic Event Fields - Title, Programs, Type, TimeZone, Dates/Times, Hosted By, Organizers, Purpose, Flyers, Agenda */}
          <BasicEventFields
            register={register}
            errors={errors}
            watch={watch}
            setValue={setValue}
            validations={validations}
            currentUser={currentUser}
            programs={programs}
            programLoading={programLoading}
            selectedOrganizers={selectedOrganizers}
            onOrganizersChange={handleOrganizersChange}
            originalFlyerUrl={null}
            originalSecondaryFlyerUrl={null}
            allowedEventTypes={filteredAllowedTypes}
          />

          {/* Format Settings - Format dropdown, Location, Zoom info, Disclaimer */}
          <FormatSettings
            register={register}
            errors={errors}
            watch={watch}
            validations={validations}
            eventData={null}
            formatWarningMissing={[]}
          />
          {/* Role Management - Template selector, role customization, CRUD operations */}
          <RoleManagement
            selectedEventType={selectedEventType}
            formRoles={formRoles}
            setValue={setValue}
            showTemplateSelector={showTemplateSelector}
            setShowTemplateSelector={setShowTemplateSelector}
            selectedTemplateId={selectedTemplateId}
            setSelectedTemplateId={setSelectedTemplateId}
            dbTemplates={dbTemplates}
            highlightTemplateSelector={highlightTemplateSelector}
            setHighlightTemplateSelector={setHighlightTemplateSelector}
            setTemplateApplied={setTemplateApplied}
            customizeRoles={customizeRoles}
            setCustomizeRoles={setCustomizeRoles}
            highlightRoleSection={highlightRoleSection}
            setHighlightRoleSection={setHighlightRoleSection}
            roleValidation={roleValidation}
            setConfirmResetModal={setConfirmResetModal}
            notification={notification}
          />

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
                  message. <strong>Note:</strong> Co-organizers will always
                  receive assignment notifications regardless of this setting.
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
                      (email + system message to all users).
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
                        Don't send notifications now
                      </span>{" "}
                      — I'll notify users later (co-organizers will still be
                      notified).
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

      {/* Confirmation Modal for template reset */}
      <ConfirmationModal
        isOpen={confirmResetModal.isOpen}
        onClose={() =>
          setConfirmResetModal({
            isOpen: false,
            title: "",
            message: "",
            onConfirm: () => {},
          })
        }
        onConfirm={confirmResetModal.onConfirm}
        title={confirmResetModal.title}
        message={confirmResetModal.message}
        confirmText="Yes"
        cancelText="Cancel"
        type="warning"
      />

      {/* Template Selector Modal for multiple templates */}
      <TemplateSelectorModal
        isOpen={templateSelectorModal}
        onClose={() => setTemplateSelectorModal(false)}
        onSelectTemplate={(template) => {
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
          setTemplateSelectorModal(false);
        }}
        templates={
          selectedEventType ? dbTemplates[selectedEventType] || [] : []
        }
        title="Select a Template"
        message="Choose a template to apply to this event. All current role configurations will be replaced."
      />
    </div>
  );
}
