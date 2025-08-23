import type { UseFormRegister, FieldErrors } from "react-hook-form";

interface Option {
  value: string;
  label: string;
}

interface SelectFieldProps {
  label: string;
  name: string;
  register: UseFormRegister<any>;
  errors: FieldErrors<any>;
  options: Option[] | readonly Option[];
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export default function SelectField({
  label,
  name,
  register,
  errors,
  options,
  placeholder = "Select an option",
  required = false,
  className = "",
}: SelectFieldProps) {
  const hasEmptyOption = options.some((o) => o.value === "");
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        {...register(name)}
        required={required}
        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 invalid:text-gray-400 ${
          errors[name] ? "border-red-500" : "border-gray-300"
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
      {typeof errors[name]?.message === "string" && (
        <p className="mt-1 text-sm text-red-600">{errors[name]?.message}</p>
      )}
    </div>
  );
}
