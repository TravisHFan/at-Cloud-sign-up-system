import type {
  UseFormRegister,
  FieldErrors,
  FieldValues,
  Path,
} from "react-hook-form";

interface FormFieldProps<T extends FieldValues = Record<string, unknown>> {
  label: string;
  name: Path<T>;
  register: UseFormRegister<T>;
  errors: FieldErrors<T>;
  type?: "text" | "email" | "tel";
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export default function FormField<
  T extends FieldValues = Record<string, unknown>
>({
  label,
  name,
  register,
  errors,
  type = "text",
  placeholder,
  required = false,
  className = "",
}: FormFieldProps<T>) {
  // Safe indexed access helpers for react-hook-form errors
  const errorMap = errors as unknown as Record<
    string,
    { message?: unknown } | undefined
  >;
  const nameKey = name as unknown as string;
  const hasError = Boolean(errorMap[nameKey]);
  const errorMessage = errorMap[nameKey]?.message;

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        {...register(name)}
        type={type}
        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          hasError ? "border-red-500" : "border-gray-300"
        }`}
        placeholder={placeholder}
      />
      {typeof errorMessage === "string" && (
        <p className="mt-1 text-sm text-red-600">{errorMessage}</p>
      )}
    </div>
  );
}
