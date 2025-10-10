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
  templates: Record<string, RoleTemplate[]> | Record<string, DbTemplate[]>,
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

    const templateData = templates[selectedEventType];

    // Handle both old format (RoleTemplate[]) and new format (DbTemplate[])
    const templateRoles: RoleTemplate[] = Array.isArray(templateData)
      ? templateData[0] && "_id" in templateData[0]
        ? (templateData as DbTemplate[])[0]?.roles || []
        : (templateData as RoleTemplate[])
      : [];

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
