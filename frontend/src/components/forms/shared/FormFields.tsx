import React from "react";
import type { UseFormRegister, FieldErrors, Path } from "react-hook-form";

interface BaseFieldProps<T extends Record<string, unknown>> {
  label: string;
  name: Path<T>;
  register: UseFormRegister<T>;
  errors: FieldErrors<T>;
  required?: boolean;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
}

interface TextFieldProps<T extends Record<string, unknown>>
  extends BaseFieldProps<T> {
  type?: "text" | "email" | "tel" | "url";
  maxLength?: number;
  minLength?: number;
}

interface PasswordFieldProps<T extends Record<string, unknown>>
  extends BaseFieldProps<T> {
  showToggle?: boolean;
  autoComplete?: string;
}

interface SelectFieldProps<T extends Record<string, unknown>>
  extends BaseFieldProps<T> {
  options: Array<{ value: string; label: string }>;
  defaultOption?: string;
}

interface TextareaFieldProps<T extends Record<string, unknown>>
  extends BaseFieldProps<T> {
  rows?: number;
  maxLength?: number;
}

// Base field wrapper with consistent styling
function FieldWrapper<T extends Record<string, unknown>>({
  label,
  name,
  required,
  errors,
  className = "",
  children,
}: {
  label: string;
  name: Path<T>;
  required?: boolean;
  errors: FieldErrors<T>;
  className?: string;
  children: React.ReactNode;
}) {
  const error = errors[name];
  const hasError = !!error;

  return (
    <div className={`space-y-2 ${className}`}>
      <label className="block text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hasError && typeof error?.message === "string" && (
        <p className="text-sm text-red-600">{error.message}</p>
      )}
    </div>
  );
}

// Text input field
export function TextField<T extends Record<string, unknown>>({
  label,
  name,
  register,
  errors,
  type = "text",
  required = false,
  className = "",
  disabled = false,
  placeholder,
  maxLength,
  minLength,
}: TextFieldProps<T>) {
  const hasError = !!errors[name];

  return (
    <FieldWrapper
      label={label}
      name={name}
      required={required}
      errors={errors}
      className={className}
    >
      <input
        {...register(name)}
        type={type}
        disabled={disabled}
        placeholder={placeholder}
        maxLength={maxLength}
        minLength={minLength}
        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
          hasError
            ? "border-red-500 focus:ring-red-500"
            : "border-gray-300 focus:border-blue-500"
        } ${disabled ? "bg-gray-50 cursor-not-allowed" : ""}`}
      />
    </FieldWrapper>
  );
}

// Password input field with optional visibility toggle
export function PasswordField<T extends Record<string, unknown>>({
  label,
  name,
  register,
  errors,
  required = false,
  className = "",
  disabled = false,
  placeholder,
  showToggle = false,
  autoComplete,
}: PasswordFieldProps<T>) {
  const [showPassword, setShowPassword] = React.useState(false);
  const hasError = !!errors[name];

  return (
    <FieldWrapper
      label={label}
      name={name}
      required={required}
      errors={errors}
      className={className}
    >
      <div className="relative">
        <input
          {...register(name)}
          type={showToggle && showPassword ? "text" : "password"}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
            hasError
              ? "border-red-500 focus:ring-red-500"
              : "border-gray-300 focus:border-blue-500"
          } ${disabled ? "bg-gray-50 cursor-not-allowed" : ""} ${
            showToggle ? "pr-10" : ""
          }`}
        />
        {showToggle && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
          >
            {showPassword ? (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"
                />
              </svg>
            ) : (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
            )}
          </button>
        )}
      </div>
    </FieldWrapper>
  );
}

// Select dropdown field
export function SelectField<T extends Record<string, unknown>>({
  label,
  name,
  register,
  errors,
  options,
  required = false,
  className = "",
  disabled = false,
  defaultOption,
}: SelectFieldProps<T>) {
  const hasError = !!errors[name];

  return (
    <FieldWrapper
      label={label}
      name={name}
      required={required}
      errors={errors}
      className={className}
    >
      <select
        {...register(name)}
        disabled={disabled}
        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
          hasError
            ? "border-red-500 focus:ring-red-500"
            : "border-gray-300 focus:border-blue-500"
        } ${disabled ? "bg-gray-50 cursor-not-allowed" : ""}`}
      >
        {defaultOption && <option value="">{defaultOption}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldWrapper>
  );
}

// Textarea field
export function TextareaField<T extends Record<string, unknown>>({
  label,
  name,
  register,
  errors,
  required = false,
  className = "",
  disabled = false,
  placeholder,
  rows = 4,
  maxLength,
}: TextareaFieldProps<T>) {
  const hasError = !!errors[name];

  return (
    <FieldWrapper
      label={label}
      name={name}
      required={required}
      errors={errors}
      className={className}
    >
      <textarea
        {...register(name)}
        rows={rows}
        disabled={disabled}
        placeholder={placeholder}
        maxLength={maxLength}
        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors resize-vertical ${
          hasError
            ? "border-red-500 focus:ring-red-500"
            : "border-gray-300 focus:border-blue-500"
        } ${disabled ? "bg-gray-50 cursor-not-allowed" : ""}`}
      />
    </FieldWrapper>
  );
}
