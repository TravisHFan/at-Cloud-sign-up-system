import { useMemo } from "react";
import type { UseFormWatch } from "react-hook-form";
import {
  validateEventField,
  getOverallValidationStatus,
  type EventValidationState,
  type FieldValidation,
} from "../utils/eventValidationUtils";
import type { EventFormData } from "../schemas/eventSchema";

export function useEventValidation(
  watch: UseFormWatch<EventFormData>,
  options?: { allowPastDates?: boolean },
) {
  const formData = watch();
  const validationFormData = {
    ...formData,
    allowPastDates: options?.allowPastDates === true,
  };
  // Create a stable key for complex objects to satisfy exhaustive-deps without over-firing
  const formKey = JSON.stringify({
    title: formData.title,
    programLabels: formData.programLabels,
    type: formData.type,
    date: formData.date,
    endDate: formData.endDate,
    time: formData.time,
    endTime: formData.endTime,
    location: formData.location,
    purpose: formData.purpose,
    agenda: formData.agenda,
    organizer: formData.organizer,
    format: formData.format,
    zoomLink: formData.zoomLink,
    roles: formData.roles,
    allowPastDates: options?.allowPastDates === true,
  });

  const validations: EventValidationState = useMemo(
    () => ({
      title: validateEventField("title", formData.title, validationFormData),
      programLabels: validateEventField(
        "programLabels",
        formData.programLabels,
        validationFormData,
      ),
      type: validateEventField("type", formData.type, validationFormData),
      date: validateEventField("date", formData.date, validationFormData),
      endDate: validateEventField(
        "endDate",
        formData.endDate,
        validationFormData,
      ),
      time: validateEventField("time", formData.time, validationFormData),
      endTime: validateEventField(
        "endTime",
        formData.endTime,
        validationFormData,
      ),
      startOverlap: validateEventField(
        "startOverlap",
        undefined,
        validationFormData,
      ),
      endOverlap: validateEventField(
        "endOverlap",
        undefined,
        validationFormData,
      ),
      location: validateEventField(
        "location",
        formData.location,
        validationFormData,
      ),
      purpose: validateEventField(
        "purpose",
        formData.purpose,
        validationFormData,
      ),
      agenda: validateEventField("agenda", formData.agenda, validationFormData),
      organizer: validateEventField(
        "organizer",
        formData.organizer,
        validationFormData,
      ),
      format: validateEventField("format", formData.format, validationFormData),
      zoomLink: validateEventField(
        "zoomLink",
        formData.zoomLink,
        validationFormData,
      ),
      roles: validateEventField("roles", formData.roles, validationFormData),
    }),
    // formKey encodes the primitive snapshot; depending only on it prevents over-firing
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [formKey]
  );

  const overallStatus: FieldValidation = useMemo(
    () => getOverallValidationStatus(validations),
    [validations]
  );

  const isFormValid = useMemo(
    () => Object.values(validations).every((validation) => validation.isValid),
    [validations]
  );

  return {
    validations,
    overallStatus,
    isFormValid,
  };
}
