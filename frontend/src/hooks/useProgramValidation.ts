import { useMemo } from "react";
import type { UseFormWatch } from "react-hook-form";
import {
  validateProgramField,
  getOverallValidationStatus,
  type ProgramValidationState,
  type FieldValidation,
} from "../utils/programValidationUtils";

// Minimal shape this hook validates; caller forms may include additional fields
export type MinimalProgramForm = {
  programType: string;
  title: string;
  startYear: string;
  startMonth: string;
  endYear: string;
  endMonth: string;
  introduction: string;
};

export function useProgramValidation<T extends MinimalProgramForm>(
  watch: UseFormWatch<T>
): {
  validations: ProgramValidationState;
  overallStatus: FieldValidation;
  isFormValid: boolean;
} {
  const formData = watch();

  // Create a stable key for complex objects to satisfy exhaustive-deps without over-firing
  const formKey = JSON.stringify({
    programType: formData.programType,
    title: formData.title,
    startYear: formData.startYear,
    startMonth: formData.startMonth,
    endYear: formData.endYear,
    endMonth: formData.endMonth,
    introduction: formData.introduction,
  });

  const validations: ProgramValidationState = useMemo(
    () => ({
      programType: validateProgramField(
        "programType",
        formData.programType,
        formData
      ),
      title: validateProgramField("title", formData.title, formData),
      startYear: validateProgramField(
        "startYear",
        formData.startYear,
        formData
      ),
      startMonth: validateProgramField(
        "startMonth",
        formData.startMonth,
        formData
      ),
      endYear: validateProgramField("endYear", formData.endYear, formData),
      endMonth: validateProgramField("endMonth", formData.endMonth, formData),
      introduction: validateProgramField(
        "introduction",
        formData.introduction,
        formData
      ),
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
