import { useState } from "react";
import type { UseFormRegister, FieldErrors } from "react-hook-form";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";

interface ConfirmPasswordFieldProps {
  register: UseFormRegister<any>;
  errors: FieldErrors<any>;
}

export default function ConfirmPasswordField({
  register,
  errors,
}: ConfirmPasswordFieldProps) {
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Confirm Password *
      </label>
      <div className="relative">
        <input
          {...register("confirmPassword")}
          type={showConfirmPassword ? "text" : "password"}
          className={`w-full px-3 py-2 pr-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.confirmPassword ? "border-red-500" : "border-gray-300"
          }`}
          placeholder="Confirm your password"
        />
        <button
          type="button"
          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {showConfirmPassword ? (
            <EyeSlashIcon className="w-5 h-5" />
          ) : (
            <EyeIcon className="w-5 h-5" />
          )}
        </button>
      </div>
      {typeof errors.confirmPassword?.message === "string" && (
        <p className="mt-1 text-sm text-red-600">
          {errors.confirmPassword.message}
        </p>
      )}
    </div>
  );
}
