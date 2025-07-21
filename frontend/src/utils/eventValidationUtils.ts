export interface FieldValidation {
  isValid: boolean;
  message: string;
  color: string;
  icon: string;
}

export interface EventValidationState {
  title: FieldValidation;
  purpose: FieldValidation;
  agenda: FieldValidation;
  organizer: FieldValidation;
  format: FieldValidation;
  roles: FieldValidation;
}

export function validateEventField(
  fieldName: string,
  value: any
): FieldValidation {
  switch (fieldName) {
    case "title":
      return validateTitle(value);
    case "purpose":
      return validatePurpose(value);
    case "agenda":
      return validateAgenda(value);
    case "organizer":
      return validateOrganizer(value);
    case "format":
      return validateFormat(value);
    case "roles":
      return validateRoles(value);
    default:
      return { isValid: true, message: "", color: "text-gray-500", icon: "" };
  }
}

function validateTitle(title: string): FieldValidation {
  if (!title || title.trim().length === 0) {
    return {
      isValid: false,
      message: "Title is required",
      color: "text-red-500",
      icon: "❌",
    };
  }

  const length = title.trim().length;
  if (length < 3) {
    return {
      isValid: false,
      message: `Title too short (${length}/3 min)`,
      color: "text-red-500",
      icon: "❌",
    };
  }

  if (length > 200) {
    return {
      isValid: false,
      message: `Title too long (${length}/200 max)`,
      color: "text-red-500",
      icon: "❌",
    };
  }

  return {
    isValid: true,
    message: `Title looks good (${length} characters)`,
    color: "text-green-500",
    icon: "✅",
  };
}

function validatePurpose(purpose: string): FieldValidation {
  if (!purpose || purpose.trim().length === 0) {
    return {
      isValid: false,
      message: "Purpose is required",
      color: "text-red-500",
      icon: "❌",
    };
  }

  const length = purpose.trim().length;
  if (length < 10) {
    return {
      isValid: false,
      message: `Purpose too short (${length}/10 min)`,
      color: "text-orange-500",
      icon: "⚠️",
    };
  }

  if (length > 1000) {
    return {
      isValid: false,
      message: `Purpose too long (${length}/1000 max)`,
      color: "text-red-500",
      icon: "❌",
    };
  }

  return {
    isValid: true,
    message: `Purpose looks good (${length} characters)`,
    color: "text-green-500",
    icon: "✅",
  };
}

function validateAgenda(agenda: string): FieldValidation {
  if (!agenda || agenda.trim().length === 0) {
    return {
      isValid: false,
      message: "Agenda is required",
      color: "text-red-500",
      icon: "❌",
    };
  }

  const length = agenda.trim().length;
  if (length < 20) {
    return {
      isValid: false,
      message: `Agenda too short (${length}/20 min)`,
      color: "text-orange-500",
      icon: "⚠️",
    };
  }

  if (length > 2000) {
    return {
      isValid: false,
      message: `Agenda too long (${length}/2000 max)`,
      color: "text-red-500",
      icon: "❌",
    };
  }

  return {
    isValid: true,
    message: `Agenda looks good (${length} characters)`,
    color: "text-green-500",
    icon: "✅",
  };
}

function validateOrganizer(organizer: string): FieldValidation {
  if (!organizer || organizer.trim().length === 0) {
    return {
      isValid: false,
      message: "Organizer name is required",
      color: "text-red-500",
      icon: "❌",
    };
  }

  const length = organizer.trim().length;
  if (length < 3) {
    return {
      isValid: false,
      message: `Organizer name too short (${length}/3 min)`,
      color: "text-red-500",
      icon: "❌",
    };
  }

  if (length > 200) {
    return {
      isValid: false,
      message: `Organizer name too long (${length}/200 max)`,
      color: "text-red-500",
      icon: "❌",
    };
  }

  return {
    isValid: true,
    message: `Organizer name looks good`,
    color: "text-green-500",
    icon: "✅",
  };
}

function validateFormat(format: string): FieldValidation {
  const validFormats = ["In-person", "Online", "Hybrid Participation"];

  if (!format || format.trim().length === 0) {
    return {
      isValid: false,
      message: "Event format is required",
      color: "text-red-500",
      icon: "❌",
    };
  }

  if (!validFormats.includes(format)) {
    return {
      isValid: false,
      message:
        "Invalid format. Choose: In-person, Online, or Hybrid Participation",
      color: "text-red-500",
      icon: "❌",
    };
  }

  return {
    isValid: true,
    message: `Format selected: ${format}`,
    color: "text-green-500",
    icon: "✅",
  };
}

function validateRoles(roles: any[]): FieldValidation {
  if (!roles || !Array.isArray(roles) || roles.length === 0) {
    return {
      isValid: false,
      message: "At least one role is required",
      color: "text-red-500",
      icon: "❌",
    };
  }

  const roleCount = roles.length;
  const invalidRoles = roles.filter(
    (role) =>
      !role.name ||
      role.name.length < 2 ||
      role.name.length > 100 ||
      !role.maxParticipants ||
      role.maxParticipants < 1 ||
      role.maxParticipants > 100
  );

  if (invalidRoles.length > 0) {
    return {
      isValid: false,
      message: `${invalidRoles.length} role(s) have validation errors`,
      color: "text-orange-500",
      icon: "⚠️",
    };
  }

  return {
    isValid: true,
    message: `${roleCount} role(s) configured properly`,
    color: "text-green-500",
    icon: "✅",
  };
}

export function getOverallValidationStatus(
  validations: EventValidationState
): FieldValidation {
  const fields = Object.values(validations);
  const invalidFields = fields.filter((field) => !field.isValid);

  if (invalidFields.length === 0) {
    return {
      isValid: true,
      message: "All fields are valid! Ready to create event.",
      color: "text-green-600",
      icon: "🎉",
    };
  }

  return {
    isValid: false,
    message: `${invalidFields.length} field(s) need attention before creating event`,
    color: "text-orange-600",
    icon: "⚠️",
  };
}
