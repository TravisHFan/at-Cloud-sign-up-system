import { useState } from "react";
import type { UseFormRegister, FieldErrors } from "react-hook-form";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { getPasswordStrength } from "../../utils/passwordStrength";

interface PasswordFieldProps {
  register: UseFormRegister<any>;
  errors: FieldErrors<any>;
  password?: string;
  showStrengthIndicator?: boolean;
}

export default function PasswordField({
  register,
  errors,
  password,
  showStrengthIndicator = false,
}: PasswordFieldProps) {
  const [showPassword, setShowPassword] = useState(false);
  const passwordStrength = getPasswordStrength(password || "");

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Password *
      </label>
      <div className="relative">
        <input
          {...register("password")}
          type={showPassword ? "text" : "password"}
          className={`w-full px-3 py-2 pr-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.password ? "border-red-500" : "border-gray-300"
          }`}
          placeholder="Enter your password"
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {showPassword ? (
            <EyeSlashIcon className="w-5 h-5" />
          ) : (
            <EyeIcon className="w-5 h-5" />
          )}
        </button>
      </div>
      {typeof errors.password?.message === "string" && (
        <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
      )}

      {/* Password Strength Indicator */}
      {showStrengthIndicator && password && (
        <div className="mt-2">
          <div className="flex items-center space-x-2">
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
