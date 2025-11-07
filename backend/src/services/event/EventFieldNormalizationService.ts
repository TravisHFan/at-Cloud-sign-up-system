import { toInstantFromWallClock } from "../../utils/event/timezoneUtils";

/**
 * EventFieldNormalizationService
 *
 * Handles normalization and validation of incoming event creation data.
 * Extracted from CreationController.ts for better organization and maintainability.
 *
 * Responsibilities:
 * - Normalize date fields (handle Date objects → YYYY-MM-DD strings)
 * - Normalize virtual meeting fields (zoomLink, meetingId, passcode)
 * - Normalize flyer URLs (flyerUrl, secondaryFlyerUrl)
 * - Normalize location field (In-person vs Online vs Hybrid)
 * - Normalize timezone field
 * - Validate required fields (conditional based on format)
 * - Validate date/time order (end after start)
 * - Validate date is not in the past
 */

interface EventFormatType {
  format: "In-person" | "Online" | "Hybrid Participation";
}

interface NormalizedEventData extends EventFormatType {
  title: string;
  type: string;
  date: string;
  endDate?: string;
  time: string;
  endTime: string;
  organizer: string;
  location?: string;
  zoomLink?: string;
  meetingId?: string;
  passcode?: string;
  flyerUrl?: string;
  secondaryFlyerUrl?: string;
  timeZone?: string;
  roles?: unknown[];
  [key: string]: unknown;
}

interface ValidationResult {
  valid: boolean;
  error?: {
    status: number;
    message: string;
    data?: unknown;
  };
}

export class EventFieldNormalizationService {
  /**
   * Normalize and validate all event fields for creation
   * Mutates the eventData object in place for consistency with controller pattern
   */
  static normalizeAndValidate(
    eventData: NormalizedEventData,
    rawBody: {
      endDate?: unknown;
      date?: unknown;
      [key: string]: unknown;
    }
  ): ValidationResult {
    // Step 1: Normalize endDate (handle Date objects)
    if (rawBody.endDate && rawBody.endDate instanceof Date) {
      eventData.endDate = rawBody.endDate.toISOString().split("T")[0];
    }

    // Step 2: Normalize virtual meeting fields
    this.normalizeVirtualMeetingFields(eventData);

    // Step 3: Normalize flyer URLs
    this.normalizeFlyerUrls(eventData);

    // Step 4: Normalize location field
    this.normalizeLocation(eventData);

    // Step 5: Normalize date field (handle Date objects)
    if (rawBody.date && rawBody.date instanceof Date) {
      eventData.date = rawBody.date.toISOString().split("T")[0];
    }

    // Step 6: Default endDate to date if not provided
    if (!eventData.endDate) {
      eventData.endDate = eventData.date;
    }

    // Step 7: Normalize timeZone
    this.normalizeTimeZone(eventData);

    // Step 8: Validate required fields (conditional based on format)
    const requiredFieldsResult = this.validateRequiredFields(eventData);
    if (!requiredFieldsResult.valid) {
      return requiredFieldsResult;
    }

    // Step 9: Validate date/time order (end after start)
    const dateOrderResult = this.validateDateTimeOrder(eventData);
    if (!dateOrderResult.valid) {
      return dateOrderResult;
    }

    // Step 10: Validate date is not in the past
    const pastDateResult = this.validateDateNotInPast(eventData);
    if (!pastDateResult.valid) {
      return pastDateResult;
    }

    // Step 11: Validate roles array exists and non-empty
    const rolesResult = this.validateRolesArray(eventData);
    if (!rolesResult.valid) {
      return rolesResult;
    }

    return { valid: true };
  }

  /**
   * Normalize virtual meeting fields based on event format
   * - In-person: remove all virtual meeting fields
   * - Online/Hybrid: trim and convert empty strings to undefined
   */
  private static normalizeVirtualMeetingFields(
    eventData: NormalizedEventData
  ): void {
    if (eventData.format === "In-person") {
      delete eventData.zoomLink;
      delete eventData.meetingId;
      delete eventData.passcode;
    } else {
      // Online or Hybrid Participation
      if (typeof eventData.zoomLink === "string") {
        const v = eventData.zoomLink.trim();
        eventData.zoomLink = v.length ? v : undefined;
      }
      if (typeof eventData.meetingId === "string") {
        const v = eventData.meetingId.trim();
        eventData.meetingId = v.length ? v : undefined;
      }
      if (typeof eventData.passcode === "string") {
        const v = eventData.passcode.trim();
        eventData.passcode = v.length ? v : undefined;
      }
    }
  }

  /**
   * Normalize flyer URLs: trim empty to undefined
   */
  private static normalizeFlyerUrls(eventData: NormalizedEventData): void {
    if (typeof eventData.flyerUrl === "string") {
      const raw = eventData.flyerUrl.trim();
      eventData.flyerUrl = raw.length ? raw : undefined;
    }

    if (typeof eventData.secondaryFlyerUrl === "string") {
      const raw = eventData.secondaryFlyerUrl.trim();
      eventData.secondaryFlyerUrl = raw.length ? raw : undefined;
    }
  }

  /**
   * Normalize location field based on event format
   * - Online: always set to "Online"
   * - In-person/Hybrid: trim empty to undefined
   */
  private static normalizeLocation(eventData: NormalizedEventData): void {
    if (eventData.format === "Online") {
      eventData.location = "Online";
    } else if (typeof eventData.location === "string") {
      const loc = eventData.location.trim();
      eventData.location = loc.length ? loc : undefined;
    }
  }

  /**
   * Normalize timezone: trim empty to undefined
   */
  private static normalizeTimeZone(eventData: NormalizedEventData): void {
    if (typeof eventData.timeZone === "string") {
      const tz = eventData.timeZone.trim();
      eventData.timeZone = tz.length ? tz : undefined;
    }
  }

  /**
   * Validate required fields (conditional based on format)
   */
  private static validateRequiredFields(
    eventData: NormalizedEventData
  ): ValidationResult {
    const baseRequiredFields = [
      "title",
      "type",
      "date",
      "endDate",
      "time",
      "endTime",
      "organizer",
      "format",
      "roles",
    ];

    // Add conditional required fields based on format
    const requiredFields = [...baseRequiredFields];
    if (eventData.format === "Online") {
      // Online: location is not required; zoomLink optional
    } else if (eventData.format === "Hybrid Participation") {
      requiredFields.push("location");
      // zoomLink is now optional for hybrid events - can be added later
    } else if (eventData.format === "In-person") {
      requiredFields.push("location");
    }

    const missingFields = requiredFields.filter(
      (field) => !eventData[field as keyof NormalizedEventData]
    );

    if (missingFields.length > 0) {
      return {
        valid: false,
        error: {
          status: 400,
          message: `Missing required fields: ${missingFields.join(", ")}`,
        },
      };
    }

    return { valid: true };
  }

  /**
   * Validate date/time order: end must be after start (timezone-aware)
   */
  private static validateDateTimeOrder(
    eventData: NormalizedEventData
  ): ValidationResult {
    const startDateObj = toInstantFromWallClock(
      eventData.date,
      eventData.time,
      eventData.timeZone
    );
    const endDateObj = toInstantFromWallClock(
      eventData.endDate!,
      eventData.endTime,
      eventData.timeZone
    );

    if (endDateObj < startDateObj) {
      return {
        valid: false,
        error: {
          status: 400,
          message: "Event end date/time must be after start date/time.",
        },
      };
    }

    return { valid: true };
  }

  /**
   * Validate date is not in the past
   * Treats YYYY-MM-DD as a wall-date in local time (not UTC)
   */
  private static validateDateNotInPast(
    eventData: NormalizedEventData
  ): ValidationResult {
    const todayLocalStr = (() => {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    })();

    if (eventData.date < todayLocalStr) {
      return {
        valid: false,
        error: {
          status: 400,
          message: "Event date must be in the future.",
        },
      };
    }

    return { valid: true };
  }

  /**
   * Validate roles array exists and is non-empty
   */
  private static validateRolesArray(
    eventData: NormalizedEventData
  ): ValidationResult {
    if (!eventData.roles || eventData.roles.length === 0) {
      return {
        valid: false,
        error: {
          status: 400,
          message: "Event must have at least one role.",
        },
      };
    }

    return { valid: true };
  }
}
