import { useMemo } from "react";

interface RoleTemplate {
  name: string;
  description: string;
  maxParticipants: number;
}

interface DbTemplate {
  _id: string;
  name: string;
  roles: RoleTemplate[];
}

interface FormRole {
  id: string;
  name: string;
  description: string;
  maxParticipants: number;
  currentSignups: unknown[];
}

interface RoleValidationResult {
  hasWarnings: boolean;
  warnings: Record<string, string>; // roleIndex -> warning message
}

export function useRoleValidation(
  formRoles: FormRole[],
  _templates: Record<string, RoleTemplate[]> | Record<string, DbTemplate[]>, // Kept for backward compatibility
  _selectedEventType: string | undefined // Kept for backward compatibility
): RoleValidationResult {
  const warnings = useMemo(() => {
    if (!formRoles.length) {
      return {};
    }

    const newWarnings: Record<string, string> = {};

    // Simple universal cap: 200 participants maximum for all roles
    const MAX_PARTICIPANTS_PER_ROLE = 200;

    formRoles.forEach((formRole, index) => {
      if (formRole.maxParticipants > MAX_PARTICIPANTS_PER_ROLE) {
        newWarnings[
          index.toString()
        ] = `Warning: ${formRole.maxParticipants} exceeds maximum allowed ${MAX_PARTICIPANTS_PER_ROLE} participants. Please reduce the number.`;
      }
    });

    return newWarnings;
  }, [formRoles]);

  return {
    hasWarnings: Object.keys(warnings).length > 0,
    warnings,
  };
}
