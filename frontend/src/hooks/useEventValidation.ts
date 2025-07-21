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
      title: validateEventField("title", formData.title),
      purpose: validateEventField("purpose", formData.purpose),
      agenda: validateEventField("agenda", formData.agenda),
      organizer: validateEventField("organizer", formData.organizer),
      format: validateEventField("format", formData.format),
      roles: validateEventField("roles", formData.roles),
    }),
    [
      formData.title,
      formData.purpose,
      formData.agenda,
      formData.organizer,
      formData.format,
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
