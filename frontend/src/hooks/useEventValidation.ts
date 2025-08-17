import { useMemo } from "react";
import type { UseFormWatch } from "react-hook-form";
import {
  validateEventField,
  getOverallValidationStatus,
  type EventValidationState,
  type FieldValidation,
} from "../utils/eventValidationUtils";
import type { EventFormData } from "../schemas/eventSchema";

export function useEventValidation(watch: UseFormWatch<EventFormData>) {
  const formData = watch();

  const validations: EventValidationState = useMemo(
    () => ({
      title: validateEventField("title", formData.title, formData),
      type: validateEventField("type", formData.type, formData),
      date: validateEventField("date", formData.date, formData),
      endDate: validateEventField("endDate", formData.endDate, formData),
      time: validateEventField("time", formData.time, formData),
      endTime: validateEventField("endTime", formData.endTime, formData),
      startOverlap: validateEventField("startOverlap", undefined, formData),
      endOverlap: validateEventField("endOverlap", undefined, formData),
      location: validateEventField("location", formData.location, formData),
      purpose: validateEventField("purpose", formData.purpose, formData),
      agenda: validateEventField("agenda", formData.agenda, formData),
      organizer: validateEventField("organizer", formData.organizer, formData),
      format: validateEventField("format", formData.format, formData),
      zoomLink: validateEventField("zoomLink", formData.zoomLink, formData),
      roles: validateEventField("roles", formData.roles, formData),
    }),
    [
      formData.title,
      formData.type,
      formData.date,
      formData.endDate,
      formData.time,
      formData.endTime,
      (formData as any)?.__startOverlapValidation,
      (formData as any)?.__endOverlapValidation,
      formData.location,
      formData.purpose,
      formData.agenda,
      formData.organizer,
      formData.format,
      formData.zoomLink,
      formData.roles,
    ]
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
