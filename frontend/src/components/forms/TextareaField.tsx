import type { UseFormRegister, FieldErrors } from "react-hook-form";

interface TextareaFieldProps {
  label: string;
  name: string;
  register: UseFormRegister<any>;
  errors: FieldErrors<any>;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  className?: string;
}

export default function TextareaField({
  label,
  name,
  register,
  errors,
  placeholder,
  required = false,
  rows = 3,
  className = "",
}: TextareaFieldProps) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label} {required && "*"}
      </label>
      <textarea
        {...register(name)}
        rows={rows}
        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          errors[name] ? "border-red-500" : "border-gray-300"
        }`}
        placeholder={placeholder}
      />
      {typeof errors[name]?.message === "string" && (
        <p className="mt-1 text-sm text-red-600">{errors[name]?.message}</p>
      )}
    </div>
  );
}
