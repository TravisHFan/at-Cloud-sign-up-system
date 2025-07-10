import { useState } from "react";
import type { UseFormRegister, FieldErrors } from "react-hook-form";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";

interface LoginPasswordFieldProps {
  register: UseFormRegister<any>;
  errors: FieldErrors<any>;
  disabled?: boolean;
  className?: string;
  required?: boolean;
}

export default function LoginPasswordField({
  register,
  errors,
  disabled = false,
  className = "",
  required = false,
}: LoginPasswordFieldProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Password {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <input
          {...register("password")}
          type={showPassword ? "text" : "password"}
          disabled={disabled}
          className={`w-full px-3 py-2 pr-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.password ? "border-red-500" : "border-gray-300"
          } ${disabled ? "bg-gray-100 cursor-not-allowed" : ""}`}
          placeholder="Enter your password"
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          disabled={disabled}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed"
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
    </div>
  );
}
