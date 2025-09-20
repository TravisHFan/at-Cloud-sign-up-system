import { PencilIcon } from "@heroicons/react/24/outline";

interface EditButtonProps {
  onClick: () => void;
  className?: string;
  disabled?: boolean;
  title?: string;
}

export default function EditButton({
  onClick,
  className = "",
  disabled = false,
  title = "Edit",
}: EditButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      <PencilIcon className="h-4 w-4 mr-1.5" />
      Edit
    </button>
  );
}
