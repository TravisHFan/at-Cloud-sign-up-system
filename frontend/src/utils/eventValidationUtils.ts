export interface FieldValidation {
  isValid: boolean;
  message: string;
  color: string;
}

export interface EventValidationState {
  title: FieldValidation;
  type: FieldValidation;
  date: FieldValidation;
  time: FieldValidation;
  endTime: FieldValidation;
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
  value: any,
  formData?: any
): FieldValidation {
  switch (fieldName) {
    case "title":
      return validateTitle(value);
    case "type":
      return validateType(value);
    case "date":
      return validateDate(value);
    case "time":
      return validateTime(value);
    case "endTime":
      return validateEndTime(value, formData?.time);
    case "location":
      return validateLocation(value, formData?.format);
    case "purpose":
      return validatePurpose(value);
    case "agenda":
      return validateAgenda(value);
    case "organizer":
      return validateOrganizer(value);
    case "format":
      return validateFormat(value);
    case "zoomLink":
      return validateZoomLink(value, formData?.format);
    case "roles":
      return validateRoles(value);
    default:
      return { isValid: true, message: "", color: "text-gray-500" };
  }
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

function validatePurpose(purpose: string): FieldValidation {
  if (!purpose || purpose.trim().length === 0) {
    return {
      isValid: false,
      message: "Purpose is required",
      color: "text-red-500",
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

function validateRoles(roles: any[]): FieldValidation {
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
      role.maxParticipants < 1 ||
      role.maxParticipants > 100
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

function validateEndTime(endTime: string, startTime?: string): FieldValidation {
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

  if (startTime && timeRegex.test(startTime)) {
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
  const fields = Object.values(validations);
  const invalidFields = fields.filter((field) => !field.isValid);

  if (invalidFields.length === 0) {
    return {
      isValid: true,
      message: "All fields are valid! Ready to create event.",
      color: "text-green-600",
    };
  }

  return {
    isValid: false,
    message: `${invalidFields.length} field(s) need attention before creating event`,
    color: "text-orange-600",
  };
}
