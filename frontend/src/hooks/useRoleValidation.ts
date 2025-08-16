import { useMemo } from "react";

interface RoleTemplate {
  name: string;
  description: string;
  maxParticipants: number;
}

interface FormRole {
  id: string;
  name: string;
  description: string;
  maxParticipants: number;
  currentSignups: any[];
}

interface RoleValidationResult {
  hasWarnings: boolean;
  warnings: Record<string, string>; // roleIndex -> warning message
}

export function useRoleValidation(
  formRoles: FormRole[],
  templates: Record<string, RoleTemplate[]>,
  selectedEventType: string | undefined
): RoleValidationResult {
  const warnings = useMemo(() => {
    if (
      !selectedEventType ||
      !templates[selectedEventType] ||
      !formRoles.length
    ) {
      return {};
    }

    const templateRoles = templates[selectedEventType];
    const newWarnings: Record<string, string> = {};

    formRoles.forEach((formRole, index) => {
      // Find the corresponding template role
      const templateRole = templateRoles.find((t) => t.name === formRole.name);
      if (templateRole) {
        const maxAllowed = templateRole.maxParticipants * 3;
        if (formRole.maxParticipants > maxAllowed) {
          newWarnings[
            index.toString()
          ] = `Warning: ${formRole.maxParticipants} exceeds recommended limit of ${maxAllowed} participants for ${formRole.name}`;
        }
      }
    });

    return newWarnings;
  }, [formRoles, templates, selectedEventType]);

  return {
    hasWarnings: Object.keys(warnings).length > 0,
    warnings,
  };
}
