import type { UseFormRegister, FieldErrors } from "react-hook-form";

interface BaseInputProps<
  TForm extends Record<string, unknown> = Record<string, unknown>
> {
  label: string;
  name: string;
  register: UseFormRegister<TForm>;
  errors: FieldErrors<TForm>;
  placeholder?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
  helperText?: string;
}

// Enhanced FormField with better styling
interface FormFieldProps<
  TForm extends Record<string, unknown> = Record<string, unknown>
> extends BaseInputProps<TForm> {
  type?: "text" | "email" | "tel" | "url" | "number";
}

export function FormField<
  TForm extends Record<string, unknown> = Record<string, unknown>
>({
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
}: FormFieldProps<TForm>) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        {...register(name as unknown as Parameters<typeof register>[0])}
        type={type}
        disabled={disabled}
        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
          disabled ? "bg-gray-50 text-gray-500 cursor-not-allowed" : "bg-white"
        } ${
          (errors as Record<string, unknown>)[name]
            ? "border-red-500 focus:ring-red-500"
            : "border-gray-300"
        }`}
        placeholder={placeholder}
      />
      {helperText && !(errors as Record<string, unknown>)[name] && (
        <p className="mt-1 text-sm text-gray-500">{helperText}</p>
      )}
      {typeof (errors as Record<string, { message?: unknown }>)[name]
        ?.message === "string" && (
        <p className="mt-1 text-sm text-red-600">
          {
            (errors as Record<string, { message?: unknown }>)[name]
              ?.message as string
          }
        </p>
      )}
    </div>
  );
}

// Enhanced TextareaField
interface TextareaFieldProps<
  TForm extends Record<string, unknown> = Record<string, unknown>
> extends BaseInputProps<TForm> {
  rows?: number;
}

export function TextareaField<
  TForm extends Record<string, unknown> = Record<string, unknown>
>({
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
}: TextareaFieldProps<TForm>) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <textarea
        {...register(name as unknown as Parameters<typeof register>[0])}
        rows={rows}
        disabled={disabled}
        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors resize-vertical ${
          disabled ? "bg-gray-50 text-gray-500 cursor-not-allowed" : "bg-white"
        } ${
          (errors as Record<string, unknown>)[name]
            ? "border-red-500 focus:ring-red-500"
            : "border-gray-300"
        }`}
        placeholder={placeholder}
      />
      {helperText && !(errors as Record<string, unknown>)[name] && (
        <p className="mt-1 text-sm text-gray-500">{helperText}</p>
      )}
      {typeof (errors as Record<string, { message?: unknown }>)[name]
        ?.message === "string" && (
        <p className="mt-1 text-sm text-red-600">
          {
            (errors as Record<string, { message?: unknown }>)[name]
              ?.message as string
          }
        </p>
      )}
    </div>
  );
}

// Enhanced SelectField
interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps<
  TForm extends Record<string, unknown> = Record<string, unknown>
> extends BaseInputProps<TForm> {
  options: readonly SelectOption[];
}

export function SelectField<
  TForm extends Record<string, unknown> = Record<string, unknown>
>({
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
}: SelectFieldProps<TForm>) {
  const hasEmptyOption = options.some((o) => o.value === "");
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        {...register(name as unknown as Parameters<typeof register>[0])}
        disabled={disabled}
        required={required}
        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors invalid:text-gray-400 ${
          disabled ? "bg-gray-50 text-gray-500 cursor-not-allowed" : "bg-white"
        } ${
          (errors as Record<string, unknown>)[name]
            ? "border-red-500 focus:ring-red-500"
            : "border-gray-300"
        }`}
      >
        {!hasEmptyOption && (
          <option value="" disabled className="text-gray-400">
            {placeholder}
          </option>
        )}
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
