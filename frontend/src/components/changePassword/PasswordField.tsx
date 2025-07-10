import type { UseFormRegister, FieldErrors } from "react-hook-form";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import type { ChangePasswordFormData } from "../../schemas/changePasswordSchema";
import PasswordStrengthIndicator from "../signup/PasswordStrengthIndicator";

interface PasswordFieldProps {
  name: "currentPassword" | "newPassword" | "confirmPassword";
  label: string;
  register: UseFormRegister<ChangePasswordFormData>;
  errors: FieldErrors<ChangePasswordFormData>;
  showPassword: boolean;
  onToggleVisibility: () => void;
  showStrengthIndicator?: boolean;
  password?: string;
}

export default function PasswordField({
  name,
  label,
  register,
  errors,
  showPassword,
  onToggleVisibility,
  showStrengthIndicator = false,
  password = "",
}: PasswordFieldProps) {
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
      {errors[name] && (
        <p className="mt-1 text-sm text-red-600">{errors[name]?.message}</p>
      )}
      {showStrengthIndicator && (
        <PasswordStrengthIndicator password={password} />
      )}
    </div>
  );
}
