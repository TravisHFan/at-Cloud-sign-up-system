interface UserPaginationProps {
  currentPage: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  onPageChange: (page: number) => void;
}

export default function UserPagination({
  currentPage,
  totalPages,
  hasNext,
  hasPrev,
  onPageChange,
}: UserPaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between mt-4">
      <div className="text-sm text-gray-600">
        Page {currentPage} of {totalPages}
      </div>
      <div className="flex space-x-2">
        <button
          disabled={!hasPrev}
          onClick={() => hasPrev && onPageChange(currentPage - 1)}
          className={`px-3 py-1 text-sm rounded border transition-colors ${
            hasPrev
              ? "bg-white hover:bg-gray-50 text-gray-700 border-gray-300"
              : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
          }`}
        >
          Previous
        </button>
        <button
          disabled={!hasNext}
          onClick={() => hasNext && onPageChange(currentPage + 1)}
          className={`px-3 py-1 text-sm rounded border transition-colors ${
            hasNext
              ? "bg-white hover:bg-gray-50 text-gray-700 border-gray-300"
              : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
          }`}
        >
          Next
        </button>
      </div>
    </div>
  );
}
