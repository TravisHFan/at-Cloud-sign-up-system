import { v4 as uuidv4 } from "uuid";
import { validateRoles } from "../../utils/event/eventValidation";
import { IEventRole } from "../../models";

/**
 * EventRolePreparationService
 *
 * Handles role preparation and validation for event creation.
 * Extracted from CreationController.ts for better organization and maintainability.
 *
 * Responsibilities:
 * - Server-side role validation (name, maxParticipants)
 * - Role data structure preparation with UUIDs
 * - Total slots calculation
 */

interface IncomingRoleData {
  name: string;
  description: string;
  maxParticipants: number;
  openToPublic?: boolean;
  agenda?: string;
  startTime?: string;
  endTime?: string;
}

interface RolePreparationResult {
  valid: boolean;
  roles?: IEventRole[];
  totalSlots?: number;
  error?: {
    status: number;
    message: string;
    errors?: unknown[];
  };
}

export class EventRolePreparationService {
  /**
   * Prepare and validate event roles
   *
   * @param incomingRoles - Array of role data from request body
   * @returns Role preparation result with prepared roles and total slots, or validation error
   */
  static prepareRoles(
    incomingRoles: IncomingRoleData[]
  ): RolePreparationResult {
    // Step 1: Enforce server-side role validation
    const roleValidation = validateRoles(
      incomingRoles.map((r) => ({
        name: r.name,
        maxParticipants: r.maxParticipants,
      }))
    );

    if (roleValidation.valid === false) {
      return {
        valid: false,
        error: {
          status: 400,
          message: "Invalid roles.",
          errors: roleValidation.errors,
        },
      };
    }

    // Step 2: Create roles with UUIDs
    const eventRoles: IEventRole[] = incomingRoles.map(
      (role: IncomingRoleData): IEventRole => ({
        id: uuidv4(),
        name: role.name,
        description: role.description,
        maxParticipants: role.maxParticipants,
        openToPublic: !!role.openToPublic,
        agenda: role.agenda || "",
        startTime: role.startTime,
        endTime: role.endTime,
        // currentSignups is not in IEventRole; signup tracking stored elsewhere
      })
    );

    // Step 3: Calculate total slots
    const totalSlots = eventRoles.reduce(
      (sum, role) => sum + role.maxParticipants,
      0
    );

    return {
      valid: true,
      roles: eventRoles,
      totalSlots,
    };
  }
}
