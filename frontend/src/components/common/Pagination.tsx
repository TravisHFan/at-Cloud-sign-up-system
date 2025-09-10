import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  onPageChange: (page: number) => void;
  showPageNumbers?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "minimal" | "rounded";
  layout?: "center" | "between";
}

export default function Pagination({
  currentPage,
  totalPages,
  hasNext,
  hasPrev,
  onPageChange,
  showPageNumbers = false,
  size = "md",
  variant = "default",
  layout = "center",
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-5 py-3 text-base",
  };

  const baseButtonClasses = {
    default:
      "border border-gray-200 bg-white hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:bg-gray-50 disabled:text-gray-300 disabled:cursor-not-allowed disabled:border-gray-100 transition-all duration-200 shadow-sm hover:shadow-md font-medium min-w-8 flex items-center justify-center text-gray-700",
    minimal:
      "bg-transparent hover:bg-blue-50 hover:text-blue-700 disabled:text-gray-300 disabled:cursor-not-allowed transition-all duration-200 font-medium min-w-8 flex items-center justify-center text-gray-700",
    rounded:
      "border border-gray-200 bg-white hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:bg-gray-50 disabled:text-gray-300 disabled:cursor-not-allowed disabled:border-gray-100 transition-all duration-200 shadow-sm hover:shadow-md font-medium rounded-full min-w-8 flex items-center justify-center text-gray-700",
  };

  // Generate page numbers to show (now unused since we use simple text format)
  // const getVisiblePages = () => {
  //   if (!showPageNumbers) return [];
  //   const pages = [];
  //   const half = Math.floor(maxVisiblePages / 2);
  //   let start = Math.max(1, currentPage - half);
  //   let end = Math.min(totalPages, start + maxVisiblePages - 1);
  //   if (end - start + 1 < maxVisiblePages) {
  //     start = Math.max(1, end - maxVisiblePages + 1);
  //   }
  //   for (let i = start; i <= end; i++) {
  //     pages.push(i);
  //   }
  //   return pages;
  // };
  // const visiblePages = getVisiblePages();

  const layoutClasses = {
    center: "justify-center",
    left: "justify-start",
    right: "justify-end",
    between: "justify-between",
  };

  return (
    <div className={`flex items-center space-x-2 ${layoutClasses[layout]}`}>
      {/* Previous Button */}
      <button
        disabled={!hasPrev}
        onClick={() => hasPrev && onPageChange(currentPage - 1)}
        className={`
          ${sizeClasses[size]} 
          ${baseButtonClasses[variant]}
          ${
            variant === "default"
              ? "rounded-lg"
              : variant === "rounded"
              ? "rounded-full"
              : "rounded-lg"
          }
          flex items-center space-x-1.5 text-gray-600
        `}
        aria-label="Previous page"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        <span className="hidden sm:inline">Prev</span>
      </button>

      {/* Page Numbers */}
      {showPageNumbers && (
        <div className="text-sm text-gray-600">
          Page {currentPage} of {totalPages}
        </div>
      )}

      {/* Current Page Info (when not showing page numbers) */}
      {!showPageNumbers && (
        <div className="text-sm text-gray-600">
          Page {currentPage} of {totalPages}
        </div>
      )}

      {/* Next Button */}
      <button
        disabled={!hasNext}
        onClick={() => hasNext && onPageChange(currentPage + 1)}
        className={`
          ${sizeClasses[size]} 
          ${baseButtonClasses[variant]}
          ${
            variant === "default"
              ? "rounded-lg"
              : variant === "rounded"
              ? "rounded-full"
              : "rounded-lg"
          }
          flex items-center space-x-1.5 text-gray-600
        `}
        aria-label="Next page"
      >
        <span className="hidden sm:inline">Next</span>
        <ChevronRightIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
