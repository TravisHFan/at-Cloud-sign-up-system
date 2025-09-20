export interface FieldValidation {
  isValid: boolean;
  message: string;
  color: string;
}

export interface ProgramValidationState {
  programType: FieldValidation;
  title: FieldValidation;
  startYear: FieldValidation;
  startMonth: FieldValidation;
  endYear: FieldValidation;
  endMonth: FieldValidation;
  introduction: FieldValidation;
}

export function validateProgramField(
  fieldName: string,
  value: unknown,
  formData?: {
    startYear?: string;
    startMonth?: string;
    endYear?: string;
    endMonth?: string;
  }
): FieldValidation {
  switch (fieldName) {
    case "programType":
      return validateProgramType(String(value ?? ""));
    case "title":
      return validateTitle(String(value ?? ""));
    case "startYear":
      return validateStartYear(String(value ?? ""));
    case "startMonth":
      return validateStartMonth(String(value ?? ""));
    case "endYear":
      return validateEndYear(String(value ?? ""), formData?.startYear);
    case "endMonth":
      return validateEndMonth(
        String(value ?? ""),
        formData?.endYear,
        formData?.startYear,
        formData?.startMonth
      );
    case "introduction":
      return validateIntroduction(String(value ?? ""));
    default:
      return { isValid: true, message: "", color: "text-gray-500" };
  }
}

function validateProgramType(programType: string): FieldValidation {
  if (!programType || programType.trim() === "") {
    return {
      isValid: false,
      message: "Program type is required",
      color: "text-red-500",
    };
  }

  // Check if provided value is in allowed program types
  const validTypes = [
    "EMBA Mentor Circles",
    "Effective Communication Workshops",
  ];
  if (!validTypes.includes(programType)) {
    return {
      isValid: false,
      message: "Invalid program type selected",
      color: "text-red-500",
    };
  }

  return {
    isValid: true,
    message: "Valid program type selected ✓",
    color: "text-green-500",
  };
}

function validateTitle(title: string): FieldValidation {
  if (!title.trim()) {
    return {
      isValid: false,
      message: "Program title is required",
      color: "text-red-500",
    };
  }

  if (title.length > 200) {
    return {
      isValid: false,
      message: "Program title must be 200 characters or less",
      color: "text-red-500",
    };
  }

  return {
    isValid: true,
    message: "Valid program title",
    color: "text-green-500",
  };
}

function validateStartYear(startYear: string): FieldValidation {
  if (!startYear.trim()) {
    return {
      isValid: false,
      message: "Start year is required",
      color: "text-red-500",
    };
  }

  const year = parseInt(startYear);
  const currentYear = new Date().getFullYear();

  if (isNaN(year) || year < currentYear || year > currentYear + 10) {
    return {
      isValid: false,
      message: `Start year must be between ${currentYear} and ${
        currentYear + 10
      }`,
      color: "text-red-500",
    };
  }

  return {
    isValid: true,
    message: "Valid start year",
    color: "text-green-500",
  };
}

function validateStartMonth(startMonth: string): FieldValidation {
  if (!startMonth.trim()) {
    return {
      isValid: false,
      message: "Start month is required",
      color: "text-red-600",
    };
  }

  const validMonths = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  if (!validMonths.includes(startMonth)) {
    return {
      isValid: false,
      message: "Please select a valid start month",
      color: "text-red-500",
    };
  }

  return {
    isValid: true,
    message: "Valid start month",
    color: "text-green-500",
  };
}

function validateEndYear(endYear: string, startYear?: string): FieldValidation {
  if (!endYear.trim()) {
    return {
      isValid: false,
      message: "End year is required",
      color: "text-red-500",
    };
  }

  const year = parseInt(endYear);
  const currentYear = new Date().getFullYear();

  if (isNaN(year) || year < currentYear || year > currentYear + 10) {
    return {
      isValid: false,
      message: `End year must be between ${currentYear} and ${
        currentYear + 10
      }`,
      color: "text-red-500",
    };
  }

  // Check if end year is not before start year
  if (startYear) {
    const startYearInt = parseInt(startYear);
    if (!isNaN(startYearInt) && year < startYearInt) {
      return {
        isValid: false,
        message: "End year cannot be before start year",
        color: "text-red-500",
      };
    }
  }

  return {
    isValid: true,
    message: "Valid end year",
    color: "text-green-500",
  };
}

function validateEndMonth(
  endMonth: string,
  endYear?: string,
  startYear?: string,
  startMonth?: string
): FieldValidation {
  if (!endMonth.trim()) {
    return {
      isValid: false,
      message: "End month is required",
      color: "text-red-500",
    };
  }

  const validMonths = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  if (!validMonths.includes(endMonth)) {
    return {
      isValid: false,
      message: "Please select a valid end month",
      color: "text-red-500",
    };
  }

  // Check if end date is not before start date (when same year)
  if (endYear && startYear && startMonth && endYear === startYear) {
    const startMonthIndex = validMonths.indexOf(startMonth);
    const endMonthIndex = validMonths.indexOf(endMonth);

    if (
      startMonthIndex !== -1 &&
      endMonthIndex !== -1 &&
      endMonthIndex < startMonthIndex
    ) {
      return {
        isValid: false,
        message: "End month cannot be before start month in the same year",
        color: "text-red-500",
      };
    }
  }

  return {
    isValid: true,
    message: "Valid end month",
    color: "text-green-500",
  };
}

function validateIntroduction(introduction: string): FieldValidation {
  if (!introduction.trim()) {
    return {
      isValid: false,
      message: "Program introduction is required",
      color: "text-red-600",
    };
  }

  if (introduction.length > 2000) {
    return {
      isValid: false,
      message: "Program introduction must be 2000 characters or less",
      color: "text-red-600",
    };
  }

  return {
    isValid: true,
    message: "Valid program introduction",
    color: "text-green-600",
  };
}

export function getOverallValidationStatus(
  validations: ProgramValidationState
): FieldValidation {
  const fields = Object.values(validations);
  const invalidFields = fields.filter((field) => !field.isValid);

  if (invalidFields.length === 0) {
    return {
      isValid: true,
      message: "All fields are valid! Ready to create program.",
      color: "text-green-600",
    };
  }

  return {
    isValid: false,
    message: `${invalidFields.length} field(s) need attention before creating program`,
    color: "text-orange-600",
  };
}
