import {
  calculatePasswordStrength,
  getPasswordStrengthWidth,
} from "../../utils/passwordUtils";

interface PasswordStrengthIndicatorProps {
  password: string;
  showIndicator?: boolean;
}

export default function PasswordStrengthIndicator({
  password,
  showIndicator = true,
}: PasswordStrengthIndicatorProps) {
  if (!showIndicator || !password) {
    return null;
  }

  const passwordStrength = calculatePasswordStrength(password);

  return (
    <div className="mt-2">
      <div className="flex items-center space-x-2">
        <div className="flex-1 bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${passwordStrength.color}`}
            style={{
              width: getPasswordStrengthWidth(passwordStrength.score),
            }}
          />
        </div>
        {passwordStrength.label && (
          <span className="text-xs font-medium text-gray-600">
            {passwordStrength.label}
          </span>
        )}
      </div>
    </div>
  );
}
