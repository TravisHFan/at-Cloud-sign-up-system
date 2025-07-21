import type { FieldValidation } from "../../utils/eventValidationUtils";

interface ValidationIndicatorProps {
  validation: FieldValidation;
  showWhenEmpty?: boolean;
}

export default function ValidationIndicator({
  validation,
  showWhenEmpty = false,
}: ValidationIndicatorProps) {
  // Don't show anything if message is empty and showWhenEmpty is false
  if (!validation.message && !showWhenEmpty) {
    return null;
  }

  return (
    <div className="mt-1 flex items-center space-x-2">
      <span className="text-sm">{validation.icon}</span>
      <span className={`text-xs ${validation.color} font-medium`}>
        {validation.message}
      </span>
    </div>
  );
}
