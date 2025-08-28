import type {
  UseFormRegister,
  FieldErrors,
  FieldValues,
  Path,
} from "react-hook-form";

interface TextareaFieldProps<T extends FieldValues> {
  label: string;
  name: Path<T>;
  register: UseFormRegister<T>;
  errors: FieldErrors<T>;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  className?: string;
}

export default function TextareaField<T extends FieldValues>({
  label,
  name,
  register,
  errors,
  placeholder,
  required = false,
  rows = 3,
  className = "",
}: TextareaFieldProps<T>) {
  const errMap = errors as unknown as Record<string, { message?: unknown }>;
  const hasError = Boolean(errMap[name as string]);
  const message = errMap[name as string]?.message;
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <textarea
        {...register(name)}
        rows={rows}
        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          hasError ? "border-red-500" : "border-gray-300"
        }`}
        placeholder={placeholder}
      />
      {typeof message === "string" && (
        <p className="mt-1 text-sm text-red-600">{message}</p>
      )}
    </div>
  );
}
