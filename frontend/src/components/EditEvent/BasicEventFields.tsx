import type {
  UseFormRegister,
  UseFormWatch,
  UseFormSetValue,
  FieldErrors,
} from "react-hook-form";
import { COMMON_TIMEZONES } from "../../data/timeZones";
import { EVENT_TYPES } from "../../config/eventConstants";
import OrganizerSelection from "../events/OrganizerSelection";
import ProgramSelection from "../events/ProgramSelection";
import ValidationIndicator from "../events/ValidationIndicator";
import type { EventFormData } from "../../schemas/eventSchema";
import type { EventData } from "../../types/event";
import type { FieldValidation } from "../../utils/eventValidationUtils";
import {
  handleDateInputChange,
  getTodayDateString,
} from "../../utils/eventStatsUtils";
import { eventService, fileService } from "../../services/api";
import { useToastReplacement } from "../../contexts/NotificationModalContext";

// Re-define Organizer locally to match OrganizerSelection component (not exported)
interface Organizer {
  id: string;
  firstName: string;
  lastName: string;
  systemAuthorizationLevel: string;
  roleInAtCloud?: string;
  gender: "male" | "female";
  avatar: string | null;
  email: string;
  phone?: string;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  roleInAtCloud?: string;
  gender?: "male" | "female";
  avatar?: string | null;
  email: string;
  phone?: string;
}

interface ValidationStates {
  title: FieldValidation;
  type: FieldValidation;
  date: FieldValidation;
  time: FieldValidation;
  endDate: FieldValidation;
  endTime: FieldValidation;
  agenda: FieldValidation;
  format: FieldValidation;
  location: FieldValidation;
  zoomLink: FieldValidation;
  startOverlap?: FieldValidation;
  endOverlap?: FieldValidation;
}

interface BasicEventFieldsProps {
  register: UseFormRegister<EventFormData>;
  errors: FieldErrors<EventFormData>;
  watch: UseFormWatch<EventFormData>;
  setValue: UseFormSetValue<EventFormData>;
  validations: ValidationStates;
  eventData?: EventData; // Optional for CreateEvent mode
  currentUser: User | null;
  programs: Array<{ id: string; title: string; programType: string }>;
  programLoading: boolean;
  selectedOrganizers: Organizer[];
  onOrganizersChange: (organizers: Organizer[]) => void;
  originalFlyerUrl: string | null;
  originalSecondaryFlyerUrl: string | null;
  id?: string; // For time conflict check
  allowedEventTypes?: string[]; // Optional: filtered event types for CreateEvent
}

/**
 * BasicEventFields Component
 *
 * Renders the basic event form fields for EditEvent:
 * - Title, Type, TimeZone
 * - Program Selection
 * - Date/Time grid (4 fields with time conflict validation)
 * - Hosted By (disabled)
 * - Organizer Selection
 * - Purpose (optional)
 * - Event Flyers (primary + secondary with upload/remove)
 * - Agenda
 */
export default function BasicEventFields({
  register,
  errors,
  watch,
  setValue,
  validations,
  eventData,
  currentUser,
  programs,
  programLoading,
  selectedOrganizers,
  onOrganizersChange,
  originalFlyerUrl,
  originalSecondaryFlyerUrl,
  id,
  allowedEventTypes, // Filtered event types for CreateEvent
}: BasicEventFieldsProps) {
  const notification = useToastReplacement();

  return (
    <>
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
          <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
        )}
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
          {allowedEventTypes
            ? allowedEventTypes.map((typeName) => (
                <option key={typeName} value={typeName}>
                  {typeName}
                </option>
              ))
            : EVENT_TYPES.map((eventType) => (
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
          Times are stored in this time zone and displayed in viewers' local
          time.
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
              onChange: (e) => {
                const normalizedDate = handleDateInputChange(e.target.value);
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
            <p className="mt-1 text-sm text-red-600">{errors.date.message}</p>
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
                  const result = await eventService.checkEventTimeConflict({
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
            <p className="mt-1 text-sm text-red-600">{errors.time.message}</p>
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
              onChange: (e) => {
                const normalizedDate = handleDateInputChange(e.target.value);
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
                if (!sDate || !sTime || !eDate || !eTime) return;
                try {
                  // 1) Point check: is the END time inside any existing event?
                  const pointResult = await eventService.checkEventTimeConflict(
                    {
                      startDate: eDate,
                      startTime: eTime,
                      mode: "point",
                      excludeId: id,
                      timeZone: watch("timeZone"),
                    }
                  );
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
                  const rangeResult = await eventService.checkEventTimeConflict(
                    {
                      startDate: sDate,
                      startTime: sTime,
                      endDate: eDate,
                      endTime: eTime,
                      mode: "range",
                      excludeId: id,
                      timeZone: watch("timeZone"),
                    }
                  );

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
              (eventData && typeof eventData.createdBy === "object"
                ? eventData.createdBy?.id
                : undefined) || currentUser.id,
            firstName:
              (eventData && typeof eventData.createdBy === "object"
                ? eventData.createdBy?.firstName
                : undefined) || currentUser.firstName,
            lastName:
              (eventData && typeof eventData.createdBy === "object"
                ? eventData.createdBy?.lastName
                : undefined) || currentUser.lastName,
            systemAuthorizationLevel:
              (eventData && typeof eventData.createdBy === "object"
                ? eventData.createdBy?.role
                : undefined) || currentUser.role,
            roleInAtCloud:
              (eventData && typeof eventData.createdBy === "object"
                ? eventData.createdBy?.roleInAtCloud
                : undefined) || currentUser.roleInAtCloud,
            gender: ((eventData && typeof eventData.createdBy === "object"
              ? eventData.createdBy?.gender
              : undefined) ||
              currentUser.gender ||
              "male") as "male" | "female",
            avatar:
              (eventData && typeof eventData.createdBy === "object"
                ? (eventData.createdBy?.avatar as string | null | undefined)
                : undefined) ||
              currentUser.avatar ||
              null,
            email:
              (eventData && typeof eventData.createdBy === "object"
                ? eventData.createdBy?.email
                : undefined) || currentUser.email,
            phone:
              (eventData && typeof eventData.createdBy === "object"
                ? eventData.createdBy?.phone
                : undefined) || currentUser.phone,
          }}
          currentUserId={currentUser.id}
          selectedOrganizers={selectedOrganizers}
          onOrganizersChange={onOrganizersChange}
        />
      )}

      {/* Purpose (optional) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Purpose
        </label>
        <p className="text-xs text-blue-600 mb-2">
          Suggested: Appears as a bold tagline / intro paragraph on the public
          event page once published. Keep it concise and compelling.
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
                  const { url } = await fileService.uploadGenericImage(file);
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
                  const { url } = await fileService.uploadGenericImage(file);
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
          <p className="mt-1 text-sm text-red-600">{errors.agenda.message}</p>
        )}
      </div>
    </>
  );
}
