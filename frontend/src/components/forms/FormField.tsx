import type { UseFormRegister, FieldErrors } from "react-hook-form";

interface FormFieldProps {
  label: string;
  name: string;
  register: UseFormRegister<any>;
  errors: FieldErrors<any>;
  type?: "text" | "email" | "tel";
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export default function FormField({
  label,
  name,
  register,
  errors,
  type = "text",
  placeholder,
  required = false,
  className = "",
}: FormFieldProps) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label} {required && "*"}
      </label>
      <input
        {...register(name)}
        type={type}
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
