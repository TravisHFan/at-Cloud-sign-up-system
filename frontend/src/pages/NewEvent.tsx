import { useEventForm } from "../hooks/useEventForm";
import { EVENT_CATEGORIES } from "../config/eventConstants";
import EventPreview from "../components/events/EventPreview";
import { COMMUNICATION_WORKSHOP_ROLES } from "../config/eventRoles";

export default function NewEvent() {
  const {
    form,
    isSubmitting,
    showPreview,
    watchIsHybrid,
    watchAllFields,
    onSubmit,
    togglePreview,
    hidePreview,
  } = useEventForm();

  const {
    register,
    formState: { errors },
  } = form;

  // Show preview if requested
  if (showPreview) {
    return (
      <EventPreview
        eventData={watchAllFields}
        isSubmitting={isSubmitting}
        onEdit={hidePreview}
        onSubmit={onSubmit}
      />
    );
  }

  // Main form render
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Create New Event
        </h1>

        <form onSubmit={onSubmit} className="space-y-6">
          {/* Event Type - Fixed for now */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Event Type
            </label>
            <input
              value="Effective Communication Workshop Series"
              readOnly
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
            />
            <p className="mt-1 text-sm text-gray-500">
              Currently, only this event type is available.
            </p>
          </div>

          {/* Basic Event Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date *
              </label>
              <input
                {...register("date")}
                type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.date && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.date.message}
                </p>
              )}
            </div>

            {/* Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Time *
              </label>
              <input
                {...register("time")}
                type="time"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.time && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.time.message}
                </p>
              )}
            </div>
          </div>

          {/* Role Configuration Section */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Configure Event Roles
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Set the number of participants needed for variable roles. Fixed
              roles cannot be changed.
            </p>

            <div className="space-y-4">
              {COMMUNICATION_WORKSHOP_ROLES.map((role, index) => (
                <div
                  key={role.name}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{role.name}</h4>
                    <p className="text-sm text-gray-600">{role.description}</p>
                  </div>
                  <div className="ml-4">
                    {role.maxParticipants === 0 ? (
                      <input
                        type="number"
                        min="1"
                        max="20"
                        defaultValue="1"
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-center"
                        placeholder="0"
                      />
                    ) : (
                      <span className="text-sm font-medium text-gray-700">
                        {role.maxParticipants}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Form Actions */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-end gap-4">
              <button
                type="button"
                onClick={togglePreview}
                className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              >
                Preview Event
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-400"
              >
                {isSubmitting ? "Creating..." : "Create Event"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
