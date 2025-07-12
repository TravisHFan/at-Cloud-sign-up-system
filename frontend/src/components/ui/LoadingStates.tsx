import { getLoadingSkeletonClass, getCardClass } from "../../utils/uiUtils";
import { LOADING_CONFIG } from "../../constants/ui";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function LoadingSpinner({
  size = "md",
  className = "",
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  };

  return (
    <svg
      className={`animate-spin ${sizeClasses[size]} ${className}`}
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
  );
}

interface ActivityLoadingProps {
  count?: number;
}

export function ActivityLoadingState({
  count = LOADING_CONFIG.SKELETON_ROWS,
}: ActivityLoadingProps) {
  return (
    <div className="text-center py-4">
      <div className="animate-pulse space-y-3">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-gray-300 rounded-full mt-2"></div>
            <div className="flex-1">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-1"></div>
              <div className="h-3 bg-gray-100 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface StatsLoadingProps {
  count?: number;
}

export function StatsLoadingState({ count = 4 }: StatsLoadingProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex justify-between items-center">
          <div className={`${getLoadingSkeletonClass("text")} w-20`}></div>
          <div className={`${getLoadingSkeletonClass("text")} w-8 h-6`}></div>
        </div>
      ))}
    </div>
  );
}

interface EventStatsLoadingProps {}

export function EventStatsLoadingState({}: EventStatsLoadingProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
      {Array.from({ length: 3 }, (_, i) => (
        <div
          key={i}
          className={`${getCardClass(false, "medium")} animate-pulse`}
        >
          <div className="h-16 bg-gray-200 rounded"></div>
        </div>
      ))}
    </div>
  );
}

interface TableLoadingProps {
  rows?: number;
  columns?: number;
}

export function TableLoadingState({
  rows = 5,
  columns = 4,
}: TableLoadingProps) {
  return (
    <div className="animate-pulse">
      <div className="space-y-3">
        {Array.from({ length: rows }, (_, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-4 gap-4">
            {Array.from({ length: columns }, (_, colIndex) => (
              <div
                key={colIndex}
                className={`${getLoadingSkeletonClass("text")} h-4`}
              ></div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

interface PageLoadingProps {
  message?: string;
}

export function PageLoadingState({ message = "Loading..." }: PageLoadingProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <LoadingSpinner size="lg" className="mb-4" />
      <p className="text-gray-600">{message}</p>
    </div>
  );
}

interface CenterLoadingProps {
  size?: "sm" | "md" | "lg";
  message?: string;
}

export function CenterLoadingState({
  size = "md",
  message,
}: CenterLoadingProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8">
      <LoadingSpinner size={size} />
      {message && <p className="text-gray-600 mt-2">{message}</p>}
    </div>
  );
}
