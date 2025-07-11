import type { EventData } from "../../types/event";

interface EventPreviewProps {
  eventData: EventData;
  isSubmitting: boolean;
  onEdit: () => void;
  onSubmit: () => void;
}

export default function EventPreview({
  eventData,
  isSubmitting,
  onEdit,
  onSubmit,
}: EventPreviewProps) {
  // Ensure we have valid data before rendering
  if (!eventData) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <p className="text-gray-500">No event data available for preview.</p>
          <button
            onClick={onEdit}
            className="mt-4 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            Back to Form
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Preview Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Event Preview</h1>
          <div className="flex gap-2">
            <button
              onClick={onEdit}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
            >
              Edit Event
            </button>
            <button
              onClick={onSubmit}
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-400"
            >
              {isSubmitting ? "Creating..." : "Create Event"}
            </button>
          </div>
        </div>
        <p className="text-gray-600">
          Review your event details before creating it. You can make changes by
          clicking "Edit Event".
        </p>
      </div>

      {/* Event Preview Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
            {eventData.category || "No Category"}
          </span>
          <span className="text-sm text-gray-500">
            {eventData.totalSlots || 0} slots available
          </span>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          {eventData.title || "Untitled Event"}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="flex items-center text-gray-600">
            <svg
              className="w-5 h-5 mr-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            {eventData.date || "No Date"}{" "}
            {eventData.time &&
              eventData.endTime &&
              `from ${eventData.time} - ${eventData.endTime}`}
          </div>
          <div className="flex items-center text-gray-600">
            <svg
              className="w-5 h-5 mr-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            {eventData.location || "No Location"}
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Description
          </h3>
          <p className="text-gray-700 leading-relaxed">
            {eventData.description || "No description provided."}
          </p>
        </div>

        {eventData.isHybrid && eventData.zoomLink && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Online Meeting Link
            </h3>
            <a
              href={eventData.zoomLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline break-all"
            >
              {eventData.zoomLink}
            </a>
          </div>
        )}

        {eventData.requirements && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Requirements
            </h3>
            <p className="text-gray-700">{eventData.requirements}</p>
          </div>
        )}

        {eventData.materials && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Materials Needed
            </h3>
            <p className="text-gray-700">{eventData.materials}</p>
          </div>
        )}
      </div>
    </div>
  );
}
