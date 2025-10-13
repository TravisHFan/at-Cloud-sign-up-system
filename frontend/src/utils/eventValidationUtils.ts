export interface FieldValidation {
  isValid: boolean;
  message: string;
  color: string;
  firstInvalidField?: string; // Name of the first invalid field (for navigation)
}

export interface EventValidationState {
  title: FieldValidation;
  programLabels?: FieldValidation;
  type: FieldValidation;
  date: FieldValidation;
  endDate: FieldValidation;
  time: FieldValidation;
  endTime: FieldValidation;
  startOverlap?: FieldValidation;
  endOverlap?: FieldValidation;
  location: FieldValidation;
  purpose: FieldValidation;
  agenda: FieldValidation;
  organizer: FieldValidation;
  format: FieldValidation;
  zoomLink: FieldValidation;
  roles: FieldValidation;
}

export function validateEventField(
  fieldName: string,
  value: unknown,
  formData?: {
    date?: string;
    endDate?: string;
    time?: string;
    format?: string;
    type?: string;
    programLabels?: string[];
    __startOverlapValidation?: FieldValidation;
    __endOverlapValidation?: FieldValidation;
  }
): FieldValidation {
  switch (fieldName) {
    case "title":
      return validateTitle(String(value ?? ""));
    case "programLabels":
      return validateProgramLabels(Array.isArray(value) ? value : []);
    case "type":
      return validateType(String(value ?? ""));
    case "date":
      return validateDate(String(value ?? ""));
    case "endDate":
      return validateEndDate(String(value ?? ""), formData?.date);
    case "time":
      return validateTime(String(value ?? ""));
    case "endTime":
      return validateEndTime(
        String(value ?? ""),
        formData?.time,
        formData?.date,
        formData?.endDate
      );
    case "startOverlap":
      return (
        formData?.__startOverlapValidation || {
          isValid: true,
          message: "",
          color: "text-gray-500",
        }
      );
    case "endOverlap":
      return (
        formData?.__endOverlapValidation || {
          isValid: true,
          message: "",
          color: "text-gray-500",
        }
      );
    case "location":
      return validateLocation(String(value ?? ""), formData?.format);
    case "purpose":
      return validatePurpose(String(value ?? ""));
    case "agenda":
      return validateAgenda(String(value ?? ""));
    case "organizer":
      return validateOrganizer(String(value ?? ""));
    case "format":
      return validateFormat(String(value ?? ""));
    case "zoomLink":
      return validateZoomLink(String(value ?? ""), formData?.format);
    case "roles":
      return validateRoles(Array.isArray(value) ? value : []);
    default:
      return { isValid: true, message: "", color: "text-gray-500" };
  }
}

function parseYMD(dateStr?: string): Date | null {
  if (!dateStr || typeof dateStr !== "string") return null;
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const dt = new Date(parseInt(y), parseInt(mo) - 1, parseInt(d));
  dt.setHours(0, 0, 0, 0);
  return isNaN(dt.getTime()) ? null : dt;
}

function validateTitle(title: string): FieldValidation {
  if (!title || title.trim().length === 0) {
    return {
      isValid: false,
      message: "Title is required",
      color: "text-red-500",
    };
  }

  const length = title.trim().length;
  if (length < 3) {
    return {
      isValid: false,
      message: `Title too short (${length}/3 min)`,
      color: "text-red-500",
    };
  }

  if (length > 200) {
    return {
      isValid: false,
      message: `Title too long (${length}/200 max)`,
      color: "text-red-500",
    };
  }

  return {
    isValid: true,
    message: `Title looks good (${length} characters)`,
    color: "text-green-500",
  };
}

function validateProgramLabels(programLabels: string[]): FieldValidation {
  // Program labels are optional - empty array is valid
  // Any array (empty or with IDs) is considered valid
  if (programLabels.length === 0) {
    return {
      isValid: true,
      message: "No programs selected (optional)",
      color: "text-gray-500",
    };
  }

  return {
    isValid: true,
    message: `${programLabels.length} program${
      programLabels.length > 1 ? "s" : ""
    } selected`,
    color: "text-green-500",
  };
}

function validatePurpose(purpose: string): FieldValidation {
  // Purpose is optional now; empty is valid
  if (!purpose || purpose.trim().length === 0) {
    return {
      isValid: true,
      message: "Purpose is optional",
      color: "text-gray-500",
    };
  }

  const length = purpose.trim().length;
  if (length < 10) {
    return {
      isValid: false,
      message: `Purpose too short (${length}/10 min)`,
      color: "text-orange-500",
    };
  }

  if (length > 1000) {
    return {
      isValid: false,
      message: `Purpose too long (${length}/1000 max)`,
      color: "text-red-500",
    };
  }

  return {
    isValid: true,
    message: `Purpose looks good (${length} characters)`,
    color: "text-green-500",
  };
}

function validateAgenda(agenda: string): FieldValidation {
  if (!agenda || agenda.trim().length === 0) {
    return {
      isValid: false,
      message: "Agenda is required",
      color: "text-red-500",
    };
  }

  const length = agenda.trim().length;
  if (length < 20) {
    return {
      isValid: false,
      message: `Agenda too short (${length}/20 min)`,
      color: "text-orange-500",
    };
  }

  if (length > 2000) {
    return {
      isValid: false,
      message: `Agenda too long (${length}/2000 max)`,
      color: "text-red-500",
    };
  }

  return {
    isValid: true,
    message: `Agenda looks good (${length} characters)`,
    color: "text-green-500",
  };
}

function validateOrganizer(organizer: string): FieldValidation {
  if (!organizer || organizer.trim().length === 0) {
    return {
      isValid: false,
      message: "Organizer name is required",
      color: "text-red-500",
    };
  }

  const length = organizer.trim().length;
  if (length < 3) {
    return {
      isValid: false,
      message: `Organizer name too short (${length}/3 min)`,
      color: "text-red-500",
    };
  }

  if (length > 200) {
    return {
      isValid: false,
      message: `Organizer name too long (${length}/200 max)`,
      color: "text-red-500",
    };
  }

  return {
    isValid: true,
    message: `Organizer name looks good`,
    color: "text-green-500",
  };
}

function validateFormat(format: string): FieldValidation {
  const validFormats = ["In-person", "Online", "Hybrid Participation"];

  if (!format || format.trim().length === 0) {
    return {
      isValid: false,
      message: "Event format is required",
      color: "text-red-500",
    };
  }

  if (!validFormats.includes(format)) {
    return {
      isValid: false,
      message:
        "Invalid format. Choose: In-person, Online, or Hybrid Participation",
      color: "text-red-500",
    };
  }

  return {
    isValid: true,
    message: `Format selected: ${format}`,
    color: "text-green-500",
  };
}

interface SimpleRole {
  name?: string;
  maxParticipants?: number;
}
function validateRoles(roles: SimpleRole[]): FieldValidation {
  if (!roles || !Array.isArray(roles) || roles.length === 0) {
    return {
      isValid: false,
      message: "At least one role is required",
      color: "text-red-500",
    };
  }

  const roleCount = roles.length;
  const invalidRoles = roles.filter(
    (role) =>
      !role.name ||
      role.name.length < 2 ||
      role.name.length > 100 ||
      !role.maxParticipants ||
      role.maxParticipants < 1
  );

  if (invalidRoles.length > 0) {
    return {
      isValid: false,
      message: `${invalidRoles.length} role(s) have validation errors`,
      color: "text-orange-500",
    };
  }

  return {
    isValid: true,
    message: `${roleCount} role(s) configured properly`,
    color: "text-green-500",
  };
}

function validateType(type: string): FieldValidation {
  if (!type || type.trim().length === 0) {
    return {
      isValid: false,
      message: "Event type is required",
      color: "text-red-500",
    };
  }

  return {
    isValid: true,
    message: `Event type selected: ${type}`,
    color: "text-green-500",
  };
}

function validateDate(date: string): FieldValidation {
  if (!date || date.trim().length === 0) {
    return {
      isValid: false,
      message: "Event date is required",
      color: "text-red-500",
    };
  }

  // Parse date safely without timezone conversion issues
  const dateMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch) {
    return {
      isValid: false,
      message: "Invalid date format",
      color: "text-red-500",
    };
  }

  const [, year, month, day] = dateMatch;
  const eventDate = new Date(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day)
  );
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (isNaN(eventDate.getTime())) {
    return {
      isValid: false,
      message: "Invalid date format",
      color: "text-red-500",
    };
  }

  if (eventDate < today) {
    return {
      isValid: false,
      message: "Event date cannot be in the past",
      color: "text-red-500",
    };
  }

  // Format the date display without timezone issues
  const displayDate = eventDate.toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return {
    isValid: true,
    message: `Event date: ${displayDate}`,
    color: "text-green-500",
  };
}

function validateEndDate(endDate: string, startDate?: string): FieldValidation {
  if (!endDate || endDate.trim().length === 0) {
    return {
      isValid: false,
      message: "End date is required",
      color: "text-red-500",
    };
  }

  const end = parseYMD(endDate);
  if (!end) {
    return {
      isValid: false,
      message: "Invalid end date format",
      color: "text-red-500",
    };
  }

  const start = parseYMD(startDate);
  if (start && end < start) {
    return {
      isValid: false,
      message: "End date cannot be before start date",
      color: "text-red-500",
    };
  }

  const displayDate = end.toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return {
    isValid: true,
    message: `End date: ${displayDate}`,
    color: "text-green-500",
  };
}

function validateTime(time: string): FieldValidation {
  if (!time || time.trim().length === 0) {
    return {
      isValid: false,
      message: "Start time is required",
      color: "text-red-500",
    };
  }

  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(time)) {
    return {
      isValid: false,
      message: "Invalid time format (use HH:MM)",
      color: "text-red-500",
    };
  }

  return {
    isValid: true,
    message: `Start time: ${time}`,
    color: "text-green-500",
  };
}

function validateEndTime(
  endTime: string,
  startTime?: string,
  startDate?: string,
  endDate?: string
): FieldValidation {
  if (!endTime || endTime.trim().length === 0) {
    return {
      isValid: false,
      message: "End time is required",
      color: "text-red-500",
    };
  }

  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(endTime)) {
    return {
      isValid: false,
      message: "Invalid time format (use HH:MM)",
      color: "text-red-500",
    };
  }

  const sDate = parseYMD(startDate);
  const eDate = parseYMD(endDate);
  const enforceSameDay =
    !sDate || !eDate || sDate.getTime() === eDate.getTime();

  if (enforceSameDay && startTime && timeRegex.test(startTime)) {
    const [startHour, startMin] = startTime.split(":").map(Number);
    const [endHour, endMin] = endTime.split(":").map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    if (endMinutes <= startMinutes) {
      return {
        isValid: false,
        message: "End time must be after start time",
        color: "text-red-500",
      };
    }
  }

  return {
    isValid: true,
    message: `End time: ${endTime}`,
    color: "text-green-500",
  };
}

function validateLocation(location: string, format?: string): FieldValidation {
  const requiresLocation =
    format === "In-person" || format === "Hybrid Participation";

  if (requiresLocation) {
    if (!location || location.trim().length === 0) {
      return {
        isValid: false,
        message: "Location is required for in-person/hybrid events",
        color: "text-red-500",
      };
    }

    const length = location.trim().length;
    if (length < 3) {
      return {
        isValid: false,
        message: `Location too short (${length}/3 min)`,
        color: "text-red-500",
      };
    }

    if (length > 200) {
      return {
        isValid: false,
        message: `Location too long (${length}/200 max)`,
        color: "text-red-500",
      };
    }

    return {
      isValid: true,
      message: `Location: ${location}`,
      color: "text-green-500",
    };
  }

  // Location not required for online-only events
  return {
    isValid: true,
    message: "Location not required for online events",
    color: "text-gray-500",
  };
}

function validateZoomLink(zoomLink: string, format?: string): FieldValidation {
  const isOnlineFormat =
    format === "Online" || format === "Hybrid Participation";

  // For non-online events, zoom link is not needed
  if (!isOnlineFormat) {
    return {
      isValid: true,
      message: "Zoom link not required for in-person events",
      color: "text-gray-500",
    };
  }

  // For online/hybrid events, zoom link is now optional (can be added later)
  if (!zoomLink || zoomLink.trim().length === 0) {
    return {
      isValid: true,
      message: "Zoom link can be added later",
      color: "text-blue-500",
    };
  }

  // If provided, validate the URL format
  const urlRegex = /^https?:\/\/.+/;
  if (!urlRegex.test(zoomLink)) {
    return {
      isValid: false,
      message: "Please provide a valid URL starting with http:// or https://",
      color: "text-red-500",
    };
  }

  return {
    isValid: true,
    message: "Zoom link provided",
    color: "text-green-500",
  };
}

export function getOverallValidationStatus(
  validations: EventValidationState
): FieldValidation {
  // Define the order of fields to check (matches form layout)
  const fieldOrder: (keyof EventValidationState)[] = [
    "title",
    "programLabels",
    "type",
    "date",
    "time",
    "startOverlap",
    "endDate",
    "endTime",
    "endOverlap",
    "agenda",
    "format",
    "location",
    "zoomLink",
    "roles",
  ];

  // Find first invalid field in order
  let firstInvalidField: string | undefined;
  let invalidCount = 0;

  for (const fieldName of fieldOrder) {
    const validation = validations[fieldName];
    if (validation && !validation.isValid) {
      invalidCount++;
      if (!firstInvalidField) {
        firstInvalidField = fieldName;
      }
    }
  }

  if (invalidCount === 0) {
    return {
      isValid: true,
      message: "All fields are valid! Ready to create event.",
      color: "text-green-600",
    };
  }

  return {
    isValid: false,
    message: `${invalidCount} field(s) need attention before creating event`,
    color: "text-orange-600",
    firstInvalidField,
  };
}
