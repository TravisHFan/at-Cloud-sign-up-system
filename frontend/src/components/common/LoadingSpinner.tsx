interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  inline?: boolean;
}

export function LoadingSpinner({
  size = "md",
  inline = false,
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-10 w-10",
    md: "h-16 w-16",
    lg: "h-24 w-24",
  };

  // Inline mode: just the spinner without full-screen container
  if (inline) {
    return (
      <div
        className={`animate-spin rounded-full border-4 border-gray-200 border-t-blue-500 ${sizeClasses[size]}`}
      ></div>
    );
  }

  // Full-screen mode: clean, centered spinner without text
  return (
    <div
      className="min-h-screen bg-gray-50 flex items-center justify-center pt-0 pb-48"
      data-testid="loading-spinner-fullscreen"
    >
      <div
        className={`animate-spin rounded-full border-4 border-gray-200 border-t-blue-500 ${sizeClasses[size]}`}
      ></div>
    </div>
  );
}

export default LoadingSpinner;
