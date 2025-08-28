import { useState } from "react";
import type { UseFormRegister, FieldErrors } from "react-hook-form";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { getPasswordStrength } from "../../../utils/passwordStrength";

/**
 * Universal Password Field Component
 * Used across all password forms: signup, change password, reset password
 * Provides consistent behavior, styling, and functionality
 */

interface UniversalPasswordFieldProps<
  TForm extends Record<string, unknown> = Record<string, unknown>
> {
  name: string;
  label: string;
  register: UseFormRegister<TForm>;
  errors: FieldErrors<TForm>;
  password?: string;
  showStrengthIndicator?: boolean;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export default function UniversalPasswordField<
  TForm extends Record<string, unknown> = Record<string, unknown>
>({
  name,
  label,
  register,
  errors,
  password,
  showStrengthIndicator = false,
  placeholder,
  required = true,
  className = "",
}: UniversalPasswordFieldProps<TForm>) {
  const [showPassword, setShowPassword] = useState(false);

  // Calculate password strength if indicator is enabled and password exists
  const passwordStrength =
    showStrengthIndicator && password ? getPasswordStrength(password) : null;

  // Generate default placeholder if not provided
  const defaultPlaceholder = placeholder || `Enter your ${label.toLowerCase()}`;

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      <div className="relative">
        <input
          {...register(name as unknown as Parameters<typeof register>[0])}
          type={showPassword ? "text" : "password"}
          className={`w-full px-3 py-2 pr-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
            errors[name] ? "border-red-500" : "border-gray-300"
          }`}
          placeholder={defaultPlaceholder}
        />

        {/* Password visibility toggle */}
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          tabIndex={-1}
        >
          {showPassword ? (
            <EyeSlashIcon className="w-5 h-5" />
          ) : (
            <EyeIcon className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Error message */}
      {typeof errors[name]?.message === "string" && (
        <p className="mt-1 text-sm text-red-600">{errors[name].message}</p>
      )}

      {/* Password Strength Indicator */}
      {showStrengthIndicator && password && passwordStrength && (
        <div className="mt-2">
          <div className="flex items-center space-x-2">
            {/* Progress bar */}
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  passwordStrength.strength <= 1
                    ? "bg-red-500"
                    : passwordStrength.strength <= 2
                    ? "bg-orange-500"
                    : passwordStrength.strength <= 3
                    ? "bg-yellow-500"
                    : passwordStrength.strength <= 4
                    ? "bg-blue-500"
                    : "bg-green-500"
                }`}
                style={{
                  width: `${(passwordStrength.strength / 5) * 100}%`,
                }}
              />
            </div>

            {/* Strength label */}
            <span
              className={`text-xs font-medium ${
                passwordStrength.strength <= 1
                  ? "text-red-600"
                  : passwordStrength.strength <= 2
                  ? "text-orange-600"
                  : passwordStrength.strength <= 3
                  ? "text-yellow-600"
                  : passwordStrength.strength <= 4
                  ? "text-blue-600"
                  : "text-green-600"
              }`}
            >
              {passwordStrength.label}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
