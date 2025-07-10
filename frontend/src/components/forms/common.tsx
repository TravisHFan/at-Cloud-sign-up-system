import type {
  UseFormRegister,
  FieldErrors,
  FieldValues,
} from "react-hook-form";

// Base interface for all form sections
export interface FormSectionProps<T extends FieldValues = any> {
  register: UseFormRegister<T>;
  errors: FieldErrors<T>;
  isEditing?: boolean;
}

// Common form section wrapper
interface FormSectionWrapperProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormSectionWrapper({
  title,
  description,
  children,
  className = "",
}: FormSectionWrapperProps) {
  return (
    <div className={`bg-white rounded-lg shadow-sm p-6 ${className}`}>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {description && (
          <p className="text-gray-600 text-sm mt-1">{description}</p>
        )}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

// Common form actions
interface FormActionsProps {
  isSubmitting?: boolean;
  submitLabel?: string;
  onCancel?: () => void;
  cancelLabel?: string;
  showCancel?: boolean;
  className?: string;
}

export function FormActions({
  isSubmitting = false,
  submitLabel = "Save",
  onCancel,
  cancelLabel = "Cancel",
  showCancel = true,
  className = "",
}: FormActionsProps) {
  return (
    <div className={`flex space-x-4 ${className}`}>
      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
      >
        {isSubmitting ? (
          <span className="flex items-center">
            <svg
              className="animate-spin -ml-1 mr-2 h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Processing...
          </span>
        ) : (
          submitLabel
        )}
      </button>

      {showCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="bg-gray-300 text-gray-700 px-6 py-2 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
        >
          {cancelLabel}
        </button>
      )}
    </div>
  );
}
