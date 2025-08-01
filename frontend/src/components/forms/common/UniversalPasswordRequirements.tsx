import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { getPasswordRequirementStatus } from "../../../schemas/common/passwordValidation";

/**
 * Universal Password Requirements Component
 * Used across all password forms: signup, change password, reset password
 * Shows real-time feedback on password requirements with consistent styling
 */

interface UniversalPasswordRequirementsProps {
  password: string;
  showTitle?: boolean;
  title?: string;
  className?: string;
}

export default function UniversalPasswordRequirements({
  password,
  showTitle = true,
  title = "Password Requirements",
  className = "",
}: UniversalPasswordRequirementsProps) {
  const requirements = getPasswordRequirementStatus(password);

  return (
    <div
      className={`bg-gray-50 border border-gray-200 rounded-lg p-4 ${className}`}
    >
      {showTitle && (
        <h4 className="text-sm font-medium text-gray-900 mb-3">{title}</h4>
      )}

      <ul className="space-y-2">
        {requirements.map((requirement) => (
          <li key={requirement.id} className="flex items-center space-x-2">
            {/* Requirement status icon */}
            {requirement.met ? (
              <CheckIcon className="w-4 h-4 text-green-600 flex-shrink-0" />
            ) : (
              <XMarkIcon
                className={`w-4 h-4 flex-shrink-0 ${
                  requirement.required ? "text-gray-400" : "text-blue-400"
                }`}
              />
            )}

            {/* Requirement text */}
            <span
              className={`text-sm ${
                requirement.met
                  ? "text-green-700"
                  : requirement.required
                  ? "text-gray-600"
                  : "text-blue-600"
              }`}
            >
              {requirement.label}
            </span>
          </li>
        ))}
      </ul>

      {/* Optional helper text */}
      <div className="mt-3 pt-3 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          Required criteria must be met for form validation. Recommended
          criteria improve password strength.
        </p>
      </div>
    </div>
  );
}
