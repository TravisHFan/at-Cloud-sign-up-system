import type { UseFormRegister, FieldErrors } from "react-hook-form";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { getPasswordStrength } from "../../utils/passwordStrength";

interface CustomPasswordFieldProps {
  name: string;
  label: string;
  register: UseFormRegister<any>;
  errors: FieldErrors<any>;
  showPassword: boolean;
  onToggleVisibility: () => void;
  showStrengthIndicator?: boolean;
  password?: string;
}

export default function CustomPasswordField({
  name,
  label,
  register,
  errors,
  showPassword,
  onToggleVisibility,
  showStrengthIndicator = false,
  password,
}: CustomPasswordFieldProps) {
  const passwordStrength = password ? getPasswordStrength(password) : null;

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label} <span className="text-red-500">*</span>
      </label>
      <div className="relative">
        <input
          {...register(name)}
          type={showPassword ? "text" : "password"}
          className={`w-full px-3 py-2 pr-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors[name] ? "border-red-500" : "border-gray-300"
          }`}
          placeholder={`Enter your ${label.toLowerCase()}`}
        />
        <button
          type="button"
          onClick={onToggleVisibility}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {showPassword ? (
            <EyeSlashIcon className="w-5 h-5" />
          ) : (
            <EyeIcon className="w-5 h-5" />
          )}
        </button>
      </div>
      {typeof errors[name]?.message === "string" && (
        <p className="mt-1 text-sm text-red-600">{errors[name].message}</p>
      )}

      {/* Password Strength Indicator */}
      {showStrengthIndicator && password && passwordStrength && (
        <div className="mt-2">
          <div className="flex items-center space-x-2">
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  passwordStrength.strength === 0
                    ? "bg-red-500"
                    : passwordStrength.strength === 1
                    ? "bg-orange-500"
                    : passwordStrength.strength === 2
                    ? "bg-yellow-500"
                    : passwordStrength.strength === 3
                    ? "bg-blue-500"
                    : "bg-green-500"
                }`}
                style={{
                  width: `${(passwordStrength.strength + 1) * 20}%`,
                }}
              />
            </div>
            <span className="text-xs text-gray-600 font-medium">
              {passwordStrength.label}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
