import type { UseFormRegister, FieldErrors } from "react-hook-form";

interface BaseInputProps {
  label: string;
  name: string;
  register: UseFormRegister<any>;
  errors: FieldErrors<any>;
  placeholder?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
  helperText?: string;
}

// Enhanced FormField with better styling
interface FormFieldProps extends BaseInputProps {
  type?: "text" | "email" | "tel" | "url" | "number";
}

export function FormField({
  label,
  name,
  register,
  errors,
  type = "text",
  placeholder,
  required = false,
  className = "",
  disabled = false,
  helperText,
}: FormFieldProps) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        {...register(name)}
        type={type}
        disabled={disabled}
        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
          disabled ? "bg-gray-50 text-gray-500 cursor-not-allowed" : "bg-white"
        } ${
          errors[name] ? "border-red-500 focus:ring-red-500" : "border-gray-300"
        }`}
        placeholder={placeholder}
      />
      {helperText && !errors[name] && (
        <p className="mt-1 text-sm text-gray-500">{helperText}</p>
      )}
      {typeof errors[name]?.message === "string" && (
        <p className="mt-1 text-sm text-red-600">{errors[name]?.message}</p>
      )}
    </div>
  );
}

// Enhanced TextareaField
interface TextareaFieldProps extends BaseInputProps {
  rows?: number;
}

export function TextareaField({
  label,
  name,
  register,
  errors,
  placeholder,
  required = false,
  className = "",
  disabled = false,
  helperText,
  rows = 3,
}: TextareaFieldProps) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <textarea
        {...register(name)}
        rows={rows}
        disabled={disabled}
        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors resize-vertical ${
          disabled ? "bg-gray-50 text-gray-500 cursor-not-allowed" : "bg-white"
        } ${
          errors[name] ? "border-red-500 focus:ring-red-500" : "border-gray-300"
        }`}
        placeholder={placeholder}
      />
      {helperText && !errors[name] && (
        <p className="mt-1 text-sm text-gray-500">{helperText}</p>
      )}
      {typeof errors[name]?.message === "string" && (
        <p className="mt-1 text-sm text-red-600">{errors[name]?.message}</p>
      )}
    </div>
  );
}

// Enhanced SelectField
interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps extends BaseInputProps {
  options: readonly SelectOption[];
}

export function SelectField({
  label,
  name,
  register,
  errors,
  placeholder = "Select an option",
  required = false,
  className = "",
  disabled = false,
  helperText,
  options,
}: SelectFieldProps) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        {...register(name)}
        disabled={disabled}
        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
          disabled ? "bg-gray-50 text-gray-500 cursor-not-allowed" : "bg-white"
        } ${
          errors[name] ? "border-red-500 focus:ring-red-500" : "border-gray-300"
        }`}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {helperText && !errors[name] && (
        <p className="mt-1 text-sm text-gray-500">{helperText}</p>
      )}
      {typeof errors[name]?.message === "string" && (
        <p className="mt-1 text-sm text-red-600">{errors[name]?.message}</p>
      )}
    </div>
  );
}
