import { PASSWORD_REQUIREMENTS } from "../../schemas/changePasswordSchema";

interface PasswordRequirementsProps {
  password: string;
}

export default function PasswordRequirements({
  password,
}: PasswordRequirementsProps) {
  return (
    <div className="bg-gray-50 p-4 rounded-md">
      <h4 className="text-sm font-medium text-gray-700 mb-2">
        Password Requirements:
      </h4>
      <ul className="text-sm text-gray-600 space-y-1">
        {PASSWORD_REQUIREMENTS.map((requirement) => (
          <li key={requirement.key} className="flex items-center">
            <span
              className={`w-2 h-2 rounded-full mr-2 ${
                requirement.test(password) ? "bg-green-500" : "bg-gray-300"
              }`}
            />
            {requirement.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
