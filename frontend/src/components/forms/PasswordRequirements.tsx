import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";

interface PasswordRequirementsProps {
  password: string;
}

export default function PasswordRequirements({
  password,
}: PasswordRequirementsProps) {
  const requirements = [
    {
      label: "At least 8 characters",
      met: password.length >= 8,
    },
    {
      label: "Contains lowercase letter",
      met: /[a-z]/.test(password),
    },
    {
      label: "Contains uppercase letter",
      met: /[A-Z]/.test(password),
    },
    {
      label: "Contains number",
      met: /\d/.test(password),
    },
    {
      label: "Contains special character (@$!%*?&)",
      met: /[@$!%*?&]/.test(password),
    },
  ];

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
      <h4 className="text-sm font-medium text-gray-900 mb-3">
        Password Requirements
      </h4>
      <ul className="space-y-2">
        {requirements.map((requirement, index) => (
          <li key={index} className="flex items-center space-x-2">
            {requirement.met ? (
              <CheckIcon className="w-4 h-4 text-green-600 flex-shrink-0" />
            ) : (
              <XMarkIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
            )}
            <span
              className={`text-sm ${
                requirement.met ? "text-green-700" : "text-gray-600"
              }`}
            >
              {requirement.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
