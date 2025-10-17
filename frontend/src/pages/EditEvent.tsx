import React, { useState, useEffect, useMemo, useRef } from "react";
import type { ChangeEvent } from "react";
import { deriveFlyerUrlForUpdate } from "../utils/flyerUrl";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useForm, type Resolver } from "react-hook-form";
import { COMMON_TIMEZONES } from "../data/timeZones";
import { yupResolver } from "@hookform/resolvers/yup";
import OrganizerSelection from "../components/events/OrganizerSelection";
import ProgramSelection from "../components/events/ProgramSelection";
import ValidationIndicator from "../components/events/ValidationIndicator";
import ConfirmationModal from "../components/common/ConfirmationModal";
import { EVENT_TYPES } from "../config/eventConstants";
import { useAuth } from "../hooks/useAuth";
import { useToastReplacement } from "../contexts/NotificationModalContext";
import { useEventValidation } from "../hooks/useEventValidation";
import { eventSchema, type EventFormData } from "../schemas/eventSchema";
import {
  eventService,
  fileService,
  programService,
  purchaseService,
  rolesTemplateService,
} from "../services/api";
import type { EventData, OrganizerDetail } from "../types/event";
import {
  PUBLISH_FIELD_LABELS,
  getMissingNecessaryFieldsForPublishFrontend,
} from "../types/event";
import type { FieldValidation } from "../utils/eventValidationUtils";
import {
  parseEventDateSafely,
  normalizeEventDate,
  handleDateInputChange,
  getTodayDateString,
} from "../utils/eventStatsUtils";
// Roles utilities
import { useRoleValidation } from "../hooks/useRoleValidation";

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

interface BackendRole {
  id?: string;
  name: string;
  description: string;
  agenda?: string;
  maxParticipants: number;
  openToPublic?: boolean;
  currentSignups?: Array<{
    userId: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    avatar?: string | null;
    gender?: string;
    systemAuthorizationLevel?: string;
    roleInAtCloud?: string;
    notes?: string;
  }>;
  registrations?: Array<{
    user?: {
      id: string;
      username?: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      avatar?: string | null;
      gender?: string;
      systemAuthorizationLevel?: string;
      role?: string;
      roleInAtCloud?: string;
    };
    userId?: string;
    notes?: string;
  }>;
}

interface FormRole {
  id: string;
  name: string;
  description: string;
  agenda?: string;
  maxParticipants: number;
  openToPublic?: boolean;
  currentSignups: Array<{
    userId: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    avatar?: string | null;
    gender?: string;
    systemAuthorizationLevel?: string;
    roleInAtCloud?: string;
    notes?: string;
  }>;
}

// Payload shape for updating a role when submitting the form
interface RoleUpdatePayload {
  id?: string; // optional because newly added roles might not yet have backend IDs
  name: string;
  description: string;
  agenda?: string;
  maxParticipants: number;
  startTime?: string;
  endTime?: string;
  openToPublic?: boolean;
}

// Payload shape for updating an event (subset / superset of EventData with optional fields)
interface EventUpdatePayload {
  title: string;
  type: string;
  format: string;
  date: string;
  endDate?: string;
  time: string;
  endTime?: string;
  timeZone?: string;
  organizer: string;
  purpose?: string;
  agenda?: string;
  location?: string;
  zoomLink?: string;
  meetingId?: string;
  passcode?: string;
  disclaimer?: string;
  hostedBy?: string;
  flyerUrl?: string | null; // null used to explicitly remove
  programLabels?: string[];
  roles: RoleUpdatePayload[];
  organizerDetails: OrganizerDetail[]; // always send array (can be empty)
  suppressNotifications?: boolean; // when user opts out of notifications
  // Allow additional properties if backend accepts flexible fields
  [key: string]: unknown;
}

export default function EditEvent() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const notification = useToastReplacement();
  const [selectedOrganizers, setSelectedOrganizers] = useState<Organizer[]>([]);
  // Track original flyer so we can decide if a blank means removal
  const [originalFlyerUrl, setOriginalFlyerUrl] = useState<string | null>(null);
  const [originalSecondaryFlyerUrl, setOriginalSecondaryFlyerUrl] = useState<
    string | null
  >(null);
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [programs, setPrograms] = useState<
    Array<{ id: string; title: string; programType: string }>
  >([]);
  const [programLoading, setProgramLoading] = useState(false);
  const [sendNotificationsPref, setSendNotificationsPref] = useState<
    boolean | null
  >(null);
  // track if user interacted with notification radios (not needed for error visibility)
  const [, setNotificationPrefTouched] = useState(false);

  const form = useForm<EventFormData>({
    resolver: yupResolver(eventSchema) as unknown as Resolver<EventFormData>,
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
      programLabels: [],
      roles: [],
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    reset,
    watch,
    getValues,
  } = form;

  // Register hidden validation fields so updates trigger re-render
  useEffect(() => {
    type HiddenValidationField =
      | "__startOverlapValidation"
      | "__endOverlapValidation";
    const registerHidden = (name: HiddenValidationField) =>
      (register as unknown as (name: string) => void)(name);
    const setHidden = (name: HiddenValidationField, value: FieldValidation) =>
      (
        setValue as unknown as (
          name: string,
          value: FieldValidation,
          options?: { shouldDirty?: boolean; shouldValidate?: boolean }
        ) => void
      )(name, value, { shouldDirty: false, shouldValidate: false });

    registerHidden("__startOverlapValidation");
    registerHidden("__endOverlapValidation");
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

  // Add validation hook and watch functionality
  const { validations } = useEventValidation(watch);

  // Watch the format field to show/hide conditional fields
  const selectedFormat = watch("format");
  const currentLocation = watch("location");
  const currentZoomLink = watch("zoomLink");
  const currentMeetingId = watch("meetingId");
  const currentPasscode = watch("passcode");
  const selectedEventType = watch("type");
  const formRoles =
    (watch("roles") as Array<{
      id: string;
      name: string;
      description: string;
      agenda?: string;
      maxParticipants: number;
      openToPublic?: boolean;
      currentSignups?: Array<unknown>;
    }>) || [];

  // Templates state for warnings; load from API with local fallback
  const [templates, setTemplates] = useState<
    Record<
      string,
      Array<{
        name: string;
        description: string;
        maxParticipants: number;
      }>
    >
  >({});
  // Database role templates for "Use Template" functionality
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
  // Note: templates loading state is not required here; warnings work without gating
  const [customizeRoles, setCustomizeRoles] = useState(false);

  // Template selector states (for "Use Template" feature)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null
  );
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [highlightTemplateSelector, setHighlightTemplateSelector] =
    useState(false);

  // Modal states for template confirmation and selection
  const [confirmResetModal, setConfirmResetModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  // Track original published state & original format for predictive warning
  const originalPublishedRef = useRef<boolean | undefined>(undefined);
  const originalFormatRef = useRef<string | undefined>(undefined);
  const [formatWarningMissing, setFormatWarningMissing] = useState<string[]>(
    []
  );

  // Derive predictive missing fields if format changed on a published event
  useEffect(() => {
    if (!eventData) return;
    if (originalPublishedRef.current === undefined) {
      originalPublishedRef.current = !!eventData.publish;
    }
    if (originalFormatRef.current === undefined) {
      originalFormatRef.current = eventData.format;
    }
    const published = !!eventData.publish;
    const formatChanged =
      selectedFormat && selectedFormat !== originalFormatRef.current;
    // Build a synthetic event snapshot with the prospective format
    if (published && formatChanged) {
      const synthetic: Partial<EventData> = {
        format: selectedFormat,
        location: currentLocation,
        zoomLink: currentZoomLink,
        meetingId: currentMeetingId,
        passcode: currentPasscode,
      } as Partial<EventData>;
      const missing = getMissingNecessaryFieldsForPublishFrontend(synthetic);
      // Only count as new missing those required by new format regardless of whether they were required previously
      setFormatWarningMissing(missing);
    } else if (formatChanged) {
      setFormatWarningMissing([]);
    } else {
      setFormatWarningMissing([]);
    }
  }, [
    eventData,
    selectedFormat,
    currentLocation,
    currentZoomLink,
    currentMeetingId,
    currentPasscode,
  ]);

  // Load database templates only (no hardcoded fallback)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await rolesTemplateService
          .getAllTemplates()
          .catch(() => ({}));
        if (!cancelled) {
          setTemplates(
            (data as Record<
              string,
              Array<{
                name: string;
                description: string;
                maxParticipants: number;
              }>
            >) || {}
          );
          // Also set dbTemplates for "Use Template" functionality
          setDbTemplates(
            (data as Record<
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
            >) || {}
          );
        }
      } catch {
        // On error, set empty templates
        if (!cancelled) {
          setTemplates({});
          setDbTemplates({});
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const roleValidation = useRoleValidation(
    formRoles.map((role) => ({
      ...role,
      currentSignups: role.currentSignups || [],
    })),
    templates,
    selectedEventType
  );

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

        // Map backend roles (which may include `registrations`) to form roles with `currentSignups`
        const rolesForForm: FormRole[] = (event.roles || []).map(
          (role: BackendRole, index: number) => ({
            id: role.id || `role-${index}`,
            name: role.name,
            description: role.description,
            agenda: role.agenda,
            maxParticipants: Number(role.maxParticipants || 0),
            openToPublic: role.openToPublic === true,
            currentSignups: Array.isArray(role.registrations)
              ? role.registrations.map((reg) => ({
                  userId: reg.user?.id || reg.userId || "",
                  username: reg.user?.username,
                  firstName: reg.user?.firstName,
                  lastName: reg.user?.lastName,
                  email: reg.user?.email,
                  phone: reg.user?.phone,
                  avatar: reg.user?.avatar,
                  gender: reg.user?.gender,
                  systemAuthorizationLevel:
                    reg.user?.role || reg.user?.systemAuthorizationLevel,
                  roleInAtCloud: reg.user?.roleInAtCloud,
                  notes: reg.notes,
                }))
              : role.currentSignups || [],
          })
        );

        setOriginalFlyerUrl(event.flyerUrl || null);
        setOriginalSecondaryFlyerUrl(event.secondaryFlyerUrl || null);
        reset({
          title: event.title || "",
          type: event.type || "",
          format: event.format || "",
          date: parseEventDateSafely(event.date),
          endDate: parseEventDateSafely(event.endDate || event.date),
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
          flyerUrl: (event as unknown as { flyerUrl?: string }).flyerUrl || "",
          secondaryFlyerUrl:
            (event as unknown as { secondaryFlyerUrl?: string })
              .secondaryFlyerUrl || "",
          programLabels:
            (event as unknown as { programLabels?: string[] }).programLabels ||
            [],
          roles: rolesForForm,
        });

        // Initialize mentorIds from existing event data if present
        const existingMentors = (
          event as unknown as {
            mentors?: Array<{
              userId: string;
              firstName?: string;
              lastName?: string;
              email?: string;
              gender?: "male" | "female";
              avatar?: string | null;
              roleInAtCloud?: string;
            }>;
          }
        ).mentors;
        if (existingMentors && existingMentors.length) {
          (setValue as unknown as (name: string, value: string[]) => void)(
            "mentorIds",
            existingMentors.map((m) => m.userId)
          );
        }

        // Check if event type exists in EVENT_TYPES array
        const typeExists = EVENT_TYPES.some((t) => t.name === event.type);

        if (!typeExists && event.type) {
          // Event type mismatch - database has type not in dropdown options
          // This could cause the dropdown to show 'Select event type' instead of current value
        }

        // Parse organizers from event data if available
        if (event.organizerDetails && Array.isArray(event.organizerDetails)) {
          const mainId =
            typeof event.createdBy === "string"
              ? event.createdBy
              : event.createdBy?.id;
          const coOrganizers = event.organizerDetails
            .filter((org) => !mainId || org.userId !== mainId)
            .map((org) => ({
              id: org.userId || "",
              firstName: org.name.split(" ")[0] || "",
              lastName: org.name.split(" ").slice(1).join(" ") || "",
              systemAuthorizationLevel: org.role,
              roleInAtCloud: org.role,
              gender: (org.gender as Organizer["gender"]) || "male",
              avatar: org.avatar ?? null,
              email: org.email || "Email not available",
              phone: org.phone,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]); // Only depend on id to prevent infinite loops

  // Load programs for selection when editing
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

  // Convert selectedOrganizers to organizerDetails format (co-organizers only)
  const organizerDetails = useMemo(() => {
    return selectedOrganizers
      .filter((organizer) => organizer.id && organizer.id.trim() !== "") // Filter out empty/invalid IDs
      .map((organizer) => ({
        name: `${organizer.firstName} ${organizer.lastName}`,
        role: organizer.roleInAtCloud || organizer.systemAuthorizationLevel,
        email: organizer.email || "Email not available",
        phone: organizer.phone || "Phone not provided",
        avatar: organizer.avatar,
        gender: organizer.gender,
        userId: organizer.id,
      }));
  }, [selectedOrganizers]);

  // MentorsPicker is now a separate component to keep identity stable and avoid remount loops

  // Use refs to stabilize setValue/getValues access and prevent infinite re-renders
  const setValueRef = useRef(setValue);
  const getValuesRef = useRef(getValues);
  useEffect(() => {
    setValueRef.current = setValue;
    getValuesRef.current = getValues;
  }, [setValue, getValues]);

  // Update form's organizer field whenever organizers change
  const handleOrganizersChange = (newOrganizers: Organizer[]) => {
    setSelectedOrganizers(newOrganizers);

    // Build organizer string as: Main Organizer + co-organizers
    const createdBy =
      typeof eventData?.createdBy === "object" && eventData?.createdBy
        ? eventData.createdBy
        : undefined;
    const mainFirst = createdBy?.firstName || currentUser?.firstName || "";
    const mainLast = createdBy?.lastName || currentUser?.lastName || "";
    const mainRole =
      createdBy?.roleInAtCloud ||
      createdBy?.role ||
      currentUser?.roleInAtCloud ||
      currentUser?.role ||
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
    // Require explicit choice of notification preference before submitting
    if (sendNotificationsPref === null) {
      setNotificationPrefTouched(true);
      notification.error("Please choose a notification option before saving.", {
        title: "Selection Required",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      // Ensure date is properly formatted to avoid timezone issues
      const normalizedDate = normalizeEventDate(data.date);

      // Build the strongly typed update payload
      const payload: EventUpdatePayload = {
        title: data.title,
        type: data.type,
        format: data.format,
        date: normalizedDate,
        endDate: data.endDate || normalizedDate,
        time: data.time,
        endTime: data.endTime,
        timeZone: data.timeZone,
        organizer: data.organizer,
        purpose: data.purpose,
        agenda: data.agenda,
        location: data.location,
        disclaimer: data.disclaimer,
        hostedBy: data.hostedBy,
        flyerUrl: deriveFlyerUrlForUpdate(originalFlyerUrl, data.flyerUrl),
        secondaryFlyerUrl: deriveFlyerUrlForUpdate(
          originalSecondaryFlyerUrl,
          data.secondaryFlyerUrl
        ),
        programLabels:
          (data as { programLabels?: string[] }).programLabels || [],
        roles: (data.roles || []).map(
          (r: FormRole & { startTime?: string; endTime?: string }) => ({
            id: r.id,
            name: r.name,
            description: r.description,
            agenda: r.agenda,
            maxParticipants: Number(r.maxParticipants || 0),
            startTime: r.startTime,
            endTime: r.endTime,
            openToPublic: r.openToPublic === true,
          })
        ),
        organizerDetails: organizerDetails || [],
      };

      // Zoom field normalization based on format
      if (
        payload.format === "Online" ||
        payload.format === "Hybrid Participation"
      ) {
        payload.zoomLink = data.zoomLink || "";
        payload.meetingId = data.meetingId || "";
        payload.passcode = data.passcode || "";
        if (payload.format === "Online") {
          payload.location = "Online"; // enforce canonical online label
        }
      } else if (payload.format === "In-person") {
        // Remove virtual fields entirely so backend can clear them
        delete (payload as { zoomLink?: string }).zoomLink;
        delete (payload as { meetingId?: string }).meetingId;
        delete (payload as { passcode?: string }).passcode;
      }

      if (sendNotificationsPref === false) {
        payload.suppressNotifications = true;
      }

      await eventService.updateEvent(id!, payload);
      notification.success("Event updated successfully!", {
        title: "Success",
        autoCloseDelay: 3000,
      });

      const state = (location.state as { returnTo?: string } | null) || null;
      const returnTo = state?.returnTo || "/dashboard/upcoming";
      navigate(returnTo);
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
            <label
              htmlFor="title"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Event Title <span className="text-red-500">*</span>
            </label>
            <input
              id="title"
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
            <label
              htmlFor="type"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Event Type <span className="text-red-500">*</span>
            </label>
            <select
              id="type"
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

          {/* Program Labels (optional) - Modal-based selection */}
          <ProgramSelection
            programs={programs}
            selectedProgramIds={
              (watch("programLabels") as string[] | undefined) || []
            }
            onProgramsChange={(programIds) => {
              setValue("programLabels", programIds, {
                shouldDirty: true,
                shouldValidate: true,
              });
            }}
            loading={programLoading}
          />

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
                    const sDate = watch("date");
                    const sTime = watch("time");
                    if (!sDate || !sTime) return;
                    try {
                      const result = await eventService.checkTimeConflict({
                        startDate: sDate,
                        startTime: sTime,
                        mode: "point",
                        excludeId: id,
                        timeZone: watch("timeZone"),
                      });
                      if (result.conflict) {
                        (
                          setValue as unknown as (
                            name: string,
                            value: FieldValidation,
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
                          { shouldDirty: false, shouldValidate: false }
                        );
                      } else {
                        (
                          setValue as unknown as (
                            name: string,
                            value: FieldValidation,
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
                          { shouldDirty: false, shouldValidate: false }
                        );
                      }
                    } catch {
                      (
                        setValue as unknown as (
                          name: string,
                          value: FieldValidation,
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
                          color: "text-gray-500",
                        },
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
              {errors.endDate && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.endDate.message}
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
                    const sDate = watch("date");
                    const sTime = watch("time");
                    const eDate = watch("endDate") || sDate;
                    const eTime = watch("endTime");
                    if (!sDate || !sTime || !eDate || !eTime) return;
                    try {
                      // 1) Point check: is the END time inside any existing event?
                      const pointResult = await eventService.checkTimeConflict({
                        startDate: eDate,
                        startTime: eTime,
                        mode: "point",
                        excludeId: id,
                        timeZone: watch("timeZone"),
                      });
                      if (pointResult.conflict) {
                        (
                          setValue as unknown as (
                            name: string,
                            value: FieldValidation,
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
                        timeZone: watch("timeZone"),
                      });

                      if (rangeResult.conflict) {
                        (
                          setValue as unknown as (
                            name: string,
                            value: FieldValidation,
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
                          { shouldDirty: false, shouldValidate: false }
                        );
                      } else {
                        (
                          setValue as unknown as (
                            name: string,
                            value: FieldValidation,
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
                          { shouldDirty: false, shouldValidate: false }
                        );
                      }
                    } catch {
                      (
                        setValue as unknown as (
                          name: string,
                          value: FieldValidation,
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
                          color: "text-gray-500",
                        },
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
                id:
                  (typeof eventData.createdBy === "string"
                    ? undefined
                    : eventData.createdBy?.id) || currentUser.id,
                firstName:
                  (typeof eventData.createdBy === "object"
                    ? eventData.createdBy?.firstName
                    : undefined) || currentUser.firstName,
                lastName:
                  (typeof eventData.createdBy === "object"
                    ? eventData.createdBy?.lastName
                    : undefined) || currentUser.lastName,
                systemAuthorizationLevel:
                  (typeof eventData.createdBy === "object"
                    ? eventData.createdBy?.role
                    : undefined) || currentUser.role,
                roleInAtCloud:
                  (typeof eventData.createdBy === "object"
                    ? eventData.createdBy?.roleInAtCloud
                    : undefined) || currentUser.roleInAtCloud,
                gender:
                  (typeof eventData.createdBy === "object"
                    ? (eventData.createdBy?.gender as Organizer["gender"])
                    : undefined) || currentUser.gender,
                avatar:
                  (typeof eventData.createdBy === "object"
                    ? (eventData.createdBy?.avatar as string | null | undefined)
                    : undefined) ||
                  currentUser.avatar ||
                  null,
                email:
                  (typeof eventData.createdBy === "object"
                    ? eventData.createdBy?.email
                    : undefined) || currentUser.email,
                phone:
                  (typeof eventData.createdBy === "object"
                    ? eventData.createdBy?.phone
                    : undefined) || currentUser.phone,
              }}
              currentUserId={currentUser.id}
              selectedOrganizers={selectedOrganizers}
              onOrganizersChange={handleOrganizersChange}
            />
          )}

          {/* Purpose (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Purpose
            </label>
            <p className="text-xs text-blue-600 mb-2">
              Suggested: Appears as a bold tagline / intro paragraph on the
              public event page once published. Keep it concise and compelling.
            </p>
            <textarea
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
                      notification.error("Failed to upload image", {
                        title: "Upload Error",
                      });
                    } finally {
                      inputEl.value = "";
                    }
                  }}
                />
              </label>
              {(watch("flyerUrl") || originalFlyerUrl) && (
                <button
                  type="button"
                  className="px-3 py-2 border rounded-md text-red-600 hover:bg-red-50"
                  title="Remove current flyer"
                  onClick={() => {
                    // Clear the field value; if original had a flyer this will trigger sending '' on submit.
                    setValue("flyerUrl", "", {
                      shouldDirty: true,
                      shouldValidate: false,
                    });
                  }}
                >
                  Remove
                </button>
              )}
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

          {/* Secondary Event Flyer (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Secondary Event Flyer (Optional)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="url"
                {...register("secondaryFlyerUrl")}
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
                      setValue("secondaryFlyerUrl", url, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    } catch (err) {
                      console.error("Secondary flyer upload failed", err);
                      notification.error("Failed to upload image", {
                        title: "Upload Error",
                      });
                    } finally {
                      inputEl.value = "";
                    }
                  }}
                />
              </label>
              {(watch("secondaryFlyerUrl") || originalSecondaryFlyerUrl) && (
                <button
                  type="button"
                  className="px-3 py-2 border rounded-md text-red-600 hover:bg-red-50"
                  title="Remove current secondary flyer"
                  onClick={() => {
                    // Clear the field value; if original had a flyer this will trigger sending '' on submit.
                    setValue("secondaryFlyerUrl", "", {
                      shouldDirty: true,
                      shouldValidate: false,
                    });
                  }}
                >
                  Remove
                </button>
              )}
            </div>
            {watch("secondaryFlyerUrl") && (
              <div className="mt-3">
                <img
                  src={watch("secondaryFlyerUrl")}
                  alt="Secondary event flyer preview"
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
            {/* Predictive format switch unpublish warning */}
            {eventData?.publish &&
              eventData.format &&
              selectedFormat &&
              selectedFormat !== eventData.format &&
              formatWarningMissing.length > 0 && (
                <div
                  className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 flex flex-col gap-1"
                  data-testid="format-switch-warning"
                >
                  <div className="font-medium flex items-center gap-2">
                    <span className="inline-block bg-amber-400 text-amber-900 px-1.5 py-0.5 rounded text-xs uppercase tracking-wide">
                      Warning
                    </span>
                    Changing format will unpublish this event
                  </div>
                  <div>
                    The selected format <strong>{selectedFormat}</strong>{" "}
                    requires the following missing field(s):{" "}
                    {formatWarningMissing
                      .map((f) => PUBLISH_FIELD_LABELS[f] || f)
                      .join(", ")}
                    . The event will be <strong>unpublished</strong> until they
                    are added.
                  </div>
                </div>
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
              placeholder="Enter disclaimer terms and conditions (optional)"
            />
            {errors.disclaimer && (
              <p className="mt-1 text-sm text-red-600">
                {errors.disclaimer.message}
              </p>
            )}
          </div>

          {/* Template Selector UI - show when user clicks "Use Template" */}
          {selectedEventType && showTemplateSelector && (
            <div
              className={`mb-6 p-4 border border-blue-200 bg-blue-50 rounded-md transition-all duration-300 ${
                highlightTemplateSelector
                  ? "ring-4 ring-blue-400 ring-opacity-75 shadow-lg scale-[1.02]"
                  : ""
              }`}
            >
              <h4 className="text-sm font-semibold text-gray-900 mb-2">
                Choose a Roles Template
              </h4>
              <p className="text-xs text-gray-600 mb-3">
                {(dbTemplates[selectedEventType] || []).length === 1
                  ? "Select the available template to get started."
                  : "Multiple role templates are available for this event type. Select one to get started."}
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
                      notification.warning("Please select a template first", {
                        title: "No Template Selected",
                      });
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
                  className="px-4 py-2 text-sm bg-gray-100 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-200"
                >
                  Configure Templates
                </button>
              </div>
            </div>
          )}

          {/* Role Configuration Section */}
          {selectedEventType &&
            formRoles.length > 0 &&
            !showTemplateSelector && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Configure Event Roles for {selectedEventType}
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Set the number of participants needed for each role. These
                  roles will be available for event registration.
                </p>

                {/* Configure Templates Link */}
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-700">
                      <p className="font-medium mb-1">Role Templates</p>
                      <p className="text-xs text-gray-600">
                        Want to manage role templates for future events?
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const templatesForType =
                            dbTemplates[selectedEventType] || [];

                          if (templatesForType.length === 0) {
                            notification.warning(
                              "No templates available for this event type",
                              {
                                title: "No Templates",
                              }
                            );
                            return;
                          }

                          if (templatesForType.length === 1) {
                            // Single template scenario - show confirmation modal
                            const template = templatesForType[0];
                            setConfirmResetModal({
                              isOpen: true,
                              title:
                                "Are you sure to reset this event's role configuration with template?",
                              message:
                                "All role configurations to your current event will be lost.",
                              onConfirm: () => {
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
                                setConfirmResetModal({
                                  isOpen: false,
                                  title: "",
                                  message: "",
                                  onConfirm: () => {},
                                });
                              },
                            });
                          } else {
                            // Multiple templates scenario - show confirmation then show dropdown
                            setConfirmResetModal({
                              isOpen: true,
                              title: "Are you sure to change template?",
                              message:
                                "All role configurations to your current event will be lost.",
                              onConfirm: () => {
                                // Reset to show the dropdown selector
                                setValue("roles", []);
                                setShowTemplateSelector(true);
                                setSelectedTemplateId(null);
                                // Trigger highlight effect
                                setHighlightTemplateSelector(true);
                                setTimeout(
                                  () => setHighlightTemplateSelector(false),
                                  1200
                                );
                                setConfirmResetModal({
                                  isOpen: false,
                                  title: "",
                                  message: "",
                                  onConfirm: () => {},
                                });
                              },
                            });
                          }
                        }}
                        className="px-4 py-2 text-sm bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                      >
                        Use Template
                      </button>
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
                </div>

                {/* Customize Roles Toggle */}
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="text-sm text-gray-600">
                    <p className="mb-1 font-medium">Customize Roles</p>
                    <p className="text-xs">
                      Changes apply to this event only and won't affect the
                      event type template.
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
                          const newRole: FormRole = {
                            id: `role-${Date.now()}`,
                            name: "New Role",
                            description: "Describe this role",
                            agenda: "",
                            maxParticipants: 1,
                            currentSignups: [],
                          };
                          setValue("roles", [newRole, ...formRoles], {
                            shouldDirty: true,
                            shouldValidate: false,
                          });
                        }}
                        className="px-3 py-2 text-sm rounded-md border border-dashed border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-blue-400 hover:text-blue-700 transition-colors"
                      >
                        + Add Role Here
                      </button>
                    </div>
                  )}
                  {formRoles.map((role, index) => {
                    const currentCount = Array.isArray(role.currentSignups)
                      ? role.currentSignups.length
                      : 0;
                    const minCap = currentCount;
                    const removeDisabled = currentCount > 0;
                    return (
                      <React.Fragment key={role.id || index}>
                        <div className="p-4 border rounded-lg">
                          <div className="flex items-start justify-between mb-4 gap-3">
                            <div className="flex-1 space-y-2">
                              {customizeRoles ? (
                                <>
                                  <input
                                    type="text"
                                    aria-label={`Role name ${index + 1}`}
                                    value={formRoles[index]?.name || ""}
                                    onChange={(e) => {
                                      const updated = [...formRoles];
                                      if (updated[index]) {
                                        updated[index] = {
                                          ...updated[index],
                                          name: e.target.value,
                                        };
                                        setValue("roles", updated, {
                                          shouldDirty: true,
                                          shouldValidate: false,
                                        });
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
                                      setValue("roles", updated, {
                                        shouldDirty: true,
                                        shouldValidate: false,
                                      });
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
                                      if (index === formRoles.length - 1)
                                        return;
                                      const updated = [...formRoles];
                                      const tmp = updated[index + 1];
                                      updated[index + 1] = updated[index];
                                      updated[index] = tmp;
                                      setValue("roles", updated, {
                                        shouldDirty: true,
                                        shouldValidate: false,
                                      });
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
                                    if (removeDisabled) return;
                                    const updated = [...formRoles];
                                    updated.splice(index, 1);
                                    setValue("roles", updated, {
                                      shouldDirty: true,
                                      shouldValidate: false,
                                    });
                                  }}
                                  disabled={removeDisabled}
                                  className={`px-2 py-1 text-xs rounded border ${
                                    removeDisabled
                                      ? "border-gray-300 text-gray-400 cursor-not-allowed"
                                      : "border-red-300 text-red-600 hover:bg-red-50"
                                  }`}
                                  title={
                                    removeDisabled
                                      ? "Cannot remove: role has registrants"
                                      : "Remove role"
                                  }
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
                                onChange={(e) => {
                                  const updated = [...formRoles];
                                  if (updated[index]) {
                                    updated[index] = {
                                      ...updated[index],
                                      agenda: e.target.value || undefined,
                                    };
                                    setValue("roles", updated, {
                                      shouldDirty: true,
                                      shouldValidate: false,
                                    });
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
                                  onChange={(e) => {
                                    const updated = [...formRoles];
                                    if (updated[index]) {
                                      updated[index] = {
                                        ...updated[index],
                                        description: e.target.value,
                                      };
                                      setValue("roles", updated, {
                                        shouldDirty: true,
                                        shouldValidate: false,
                                      });
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
                                  min={minCap}
                                  aria-label={`Max participants for ${
                                    formRoles[index]?.name ||
                                    `role ${index + 1}`
                                  }`}
                                  value={formRoles[index]?.maxParticipants || 0}
                                  onChange={(e) => {
                                    const raw = parseInt(
                                      e.target.value || "0",
                                      10
                                    );
                                    const next = isNaN(raw)
                                      ? minCap
                                      : Math.max(minCap, raw);
                                    const updated = [...formRoles];
                                    if (updated[index]) {
                                      updated[index] = {
                                        ...updated[index],
                                        maxParticipants: next,
                                      };
                                      setValue("roles", updated, {
                                        shouldDirty: true,
                                        shouldValidate: false,
                                      });
                                    }
                                  }}
                                  className={`w-20 px-2 py-1 border rounded text-center ${
                                    roleValidation.warnings[index]?.length
                                      ? "border-orange-500 bg-orange-50"
                                      : "border-gray-300"
                                  }`}
                                />
                              </div>
                              {roleValidation.warnings[index]?.length ? (
                                <p className="text-xs text-orange-600 mt-1">
                                  {roleValidation.warnings[index]}
                                </p>
                              ) : null}
                              {currentCount > 0 && (
                                <p className="text-xs text-gray-500 mt-1">
                                  {currentCount} currently registered
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
                                    (
                                      formRoles[index] as {
                                        openToPublic?: boolean;
                                      }
                                    )?.openToPublic || false
                                  }
                                  onChange={(e) => {
                                    const updated = [...formRoles];
                                    if (updated[index]) {
                                      updated[index] = {
                                        ...updated[index],
                                        openToPublic: e.target.checked,
                                      };
                                      setValue("roles", updated, {
                                        shouldDirty: true,
                                        shouldValidate: false,
                                      });
                                    }
                                  }}
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-600">
                                  Open to public registration
                                </span>
                              </label>
                              <p className="text-xs text-gray-500">
                                When enabled, this role will be available for
                                public sign-up when the event is published
                              </p>
                            </div>
                          </div>
                        </div>
                        {customizeRoles && (
                          <div className="flex justify-center py-2">
                            <button
                              type="button"
                              onClick={() => {
                                const newRole: FormRole = {
                                  id: `role-${Date.now()}`,
                                  name: "New Role",
                                  description: "Describe this role",
                                  agenda: "",
                                  maxParticipants: 1,
                                  currentSignups: [],
                                };
                                const updated = [...formRoles];
                                updated.splice(index + 1, 0, newRole);
                                setValue("roles", updated, {
                                  shouldDirty: true,
                                  shouldValidate: false,
                                });
                              }}
                              className="px-3 py-2 text-sm rounded-md border border-dashed border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-blue-400 hover:text-blue-700 transition-colors"
                            >
                              + Add Role Here
                            </button>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            )}

          {/* Notification preference (required) */}
          <div className="pt-6 border-t border-gray-200">
            <fieldset>
              <legend className="block text-sm font-medium text-gray-700 mb-1">
                Send notifications about this update?{" "}
                <span className="text-red-500">*</span>
              </legend>
              <p className="text-xs text-gray-500 mb-2">
                Choose whether to notify the registered users and guests now via
                email and a system message.
              </p>
              <div className="space-y-2">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="notifyUpdatePref"
                    value="send"
                    checked={sendNotificationsPref === true}
                    onChange={() => {
                      setSendNotificationsPref(true);
                      setNotificationPrefTouched(true);
                    }}
                    className="mt-1"
                  />
                  <span className="text-sm text-gray-700">
                    <span className="font-medium">Send notifications now</span>{" "}
                    (email + system message).
                  </span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="notifyUpdatePref"
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

          {/* Form Actions */}
          <div className="flex items-center justify-between pt-6">
            <button
              type="button"
              onClick={() => {
                const state =
                  (location.state as { returnTo?: string } | null) || null;
                const returnTo = state?.returnTo || "/dashboard/upcoming";
                navigate(returnTo);
              }}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting || sendNotificationsPref === null}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-400"
              aria-disabled={isSubmitting || sendNotificationsPref === null}
            >
              {isSubmitting ? "Updating..." : "Update Event"}
            </button>
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
    </div>
  );
}
