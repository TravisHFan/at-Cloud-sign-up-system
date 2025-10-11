import type { FieldValidation } from "../../utils/eventValidationUtils";

interface ValidationIndicatorProps {
  validation: FieldValidation;
  showWhenEmpty?: boolean;
  onClick?: () => void; // Optional click handler for navigation
}

export default function ValidationIndicator({
  validation,
  showWhenEmpty = false,
  onClick,
}: ValidationIndicatorProps) {
  // Don't show anything if message is empty and showWhenEmpty is false
  if (!validation.message && !showWhenEmpty) {
    return null;
  }

  const isClickable = onClick && !validation.isValid;

  return (
    <div className="mt-1">
      <span
        className={`text-sm ${validation.color} font-medium ${
          isClickable
            ? "cursor-pointer hover:underline hover:opacity-80 transition-opacity"
            : ""
        }`}
        onClick={isClickable ? onClick : undefined}
        role={isClickable ? "button" : undefined}
        tabIndex={isClickable ? 0 : undefined}
        onKeyDown={
          isClickable
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onClick();
                }
              }
            : undefined
        }
      >
        {validation.message}
        {isClickable && (
          <span className="ml-1 text-xs font-normal opacity-75">
            (click to jump)
          </span>
        )}
      </span>
    </div>
  );
}
