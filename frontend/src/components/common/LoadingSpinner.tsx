interface LoadingSpinnerProps {
  message?: string;
  size?: "sm" | "md" | "lg";
  inline?: boolean;
}

export function LoadingSpinner({
  message = "Loading...",
  size = "md",
  inline = false,
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-12 w-12",
    lg: "h-16 w-16",
  };

  // Inline mode: just the spinner without full-screen container
  if (inline) {
    return (
      <div
        className={`animate-spin rounded-full border-4 border-gray-200 border-t-blue-500 ${sizeClasses[size]}`}
      ></div>
    );
  }

  // Full-screen mode: with container and message
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
      <div
        className={`animate-spin rounded-full border-4 border-gray-200 border-t-blue-500 ${sizeClasses[size]}`}
      ></div>
      <p className="mt-4 text-gray-600 text-lg">{message}</p>
    </div>
  );
}

export default LoadingSpinner;
