import { useState, useEffect, useMemo } from "react";
import { useEventForm } from "../hooks/useEventForm";
import EventPreview from "../components/events/EventPreview";
import OrganizerSelection from "../components/events/OrganizerSelection";
import { getRolesByEventType } from "../config/eventRoles";
import { EVENT_TYPES } from "../config/eventConstants";
import { useAuth } from "../hooks/useAuth";

interface Organizer {
  id: string; // UUID to match User interface
  firstName: string;
  lastName: string;
  systemAuthorizationLevel: string;
  roleInAtCloud?: string;
  gender: "male" | "female";
  avatar: string | null;
}

export default function NewEvent() {
  const { currentUser } = useAuth();
  const [selectedOrganizers, setSelectedOrganizers] = useState<Organizer[]>([]);

  // Convert organizers to format needed for email notifications
  const organizerEmailInfo = useMemo(() => {
    return selectedOrganizers.map((org) => {
      return {
        id: org.id,
        firstName: org.firstName,
        lastName: org.lastName,
        email: `${org.firstName.toLowerCase()}.${org.lastName.toLowerCase()}@atcloud.org`, // Use organization email pattern
      };
    });
  }, [selectedOrganizers]);

  const {
    form,
    isSubmitting,
    showPreview,
    watchAllFields,
    onSubmit,
    togglePreview,
    hidePreview,
  } = useEventForm(organizerEmailInfo);

  const { setValue } = form;

  // Initialize organizer field with current user
  useEffect(() => {
    if (!currentUser) return;

    const role = currentUser.roleInAtCloud || currentUser.role;
    const initialOrganizer = `${currentUser.firstName} ${currentUser.lastName} (${role})`;
    setValue("organizer", initialOrganizer);
  }, [setValue, currentUser]);

  // Update form's organizer field whenever organizers change
  const handleOrganizersChange = (newOrganizers: Organizer[]) => {
    setSelectedOrganizers(newOrganizers);

    if (!currentUser) return;

    // Convert current user to Organizer format
    const currentUserAsOrganizer: Organizer = {
      id: currentUser.id,
      firstName: currentUser.firstName,
      lastName: currentUser.lastName,
      systemAuthorizationLevel: currentUser.role,
      roleInAtCloud: currentUser.roleInAtCloud,
      gender: currentUser.gender,
      avatar: currentUser.avatar || null,
    };

    // Update the form's organizer field
    const allOrganizers = [currentUserAsOrganizer, ...newOrganizers];
    const formattedOrganizers = allOrganizers
      .map((org) => {
        const role = org.roleInAtCloud || org.systemAuthorizationLevel;
        return `${org.firstName} ${org.lastName} (${role})`;
      })
      .join(", ");

    setValue("organizer", formattedOrganizers);
  };

  const {
    register,
    formState: { errors },
    watch,
  } = form;

  // Watch the format field to show/hide conditional fields
  const selectedFormat = watch("format");

  // Watch the selected event type to dynamically load roles
  const selectedEventType = watch("type");
  const currentRoles = useMemo(() => {
    if (!selectedEventType) return [];
    return getRolesByEventType(selectedEventType);
  }, [selectedEventType]);

  // Show preview if requested
  if (showPreview) {
    // Convert form data to EventData format for preview
    const previewData = {
      ...watchAllFields,
      location: watchAllFields.location || "",
      hostedBy: watchAllFields.hostedBy || "",
      zoomLink: watchAllFields.zoomLink || "",
      meetingId: watchAllFields.meetingId || "",
      passcode: watchAllFields.passcode || "",
      requirements: watchAllFields.requirements || "",
      materials: watchAllFields.materials || "",
      disclaimer: watchAllFields.disclaimer || undefined, // Handle optional disclaimer
      roles: watchAllFields.roles.map((role) => ({
        ...role,
        currentSignups: role.currentSignups || [],
      })),
    };

    return (
      <EventPreview
        eventData={previewData}
        isSubmitting={isSubmitting}
        onEdit={hidePreview}
        onSubmit={onSubmit}
      />
    );
  }

  // Main form render
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Create New Event
        </h1>

        <form onSubmit={onSubmit} className="space-y-6">
          {/* Event Type - Dropdown selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Event Type <span className="text-red-500">*</span>
            </label>
            <select
              {...register("type")}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select event type</option>
              {EVENT_TYPES.map((eventType) => (
                <option key={eventType.id} value={eventType.name}>
                  {eventType.name}
                </option>
              ))}
            </select>
            {errors.type && (
              <p className="mt-1 text-sm text-red-600">{errors.type.message}</p>
            )}
            <p className="mt-1 text-sm text-gray-500">
              Select the type of event you want to create.
            </p>
          </div>

          {/* Basic Event Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date <span className="text-red-500">*</span>
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

            {/* Start Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Time <span className="text-red-500">*</span>
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

            {/* End Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Time <span className="text-red-500">*</span>
              </label>
              <input
                {...register("endTime")}
                type="time"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.endTime && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.endTime.message}
                </p>
              )}
            </div>
          </div>

          {/* Hosted by */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Hosted by
            </label>
            <input
              {...register("hostedBy")}
              type="text"
              value="@Cloud Marketplace Ministry"
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600 cursor-not-allowed"
            />
            <p className="mt-1 text-sm text-gray-500">
              This field cannot be changed
            </p>
          </div>

          {/* Organizers */}
          {currentUser && (
            <OrganizerSelection
              currentUser={{
                id: currentUser.id,
                firstName: currentUser.firstName,
                lastName: currentUser.lastName,
                systemAuthorizationLevel: currentUser.role,
                roleInAtCloud: currentUser.roleInAtCloud,
                gender: currentUser.gender,
                avatar: currentUser.avatar || null,
              }}
              selectedOrganizers={selectedOrganizers}
              onOrganizersChange={handleOrganizersChange}
            />
          )}

          {/* Purpose */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Purpose <span className="text-red-500">*</span>
            </label>
            <textarea
              {...register("purpose")}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Describe the purpose of this event"
            />
            {errors.purpose && (
              <p className="mt-1 text-sm text-red-600">
                {errors.purpose.message}
              </p>
            )}
          </div>

          {/* Event Agenda and Schedule */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Event Agenda and Schedule <span className="text-red-500">*</span>
            </label>
            <textarea
              {...register("agenda")}
              rows={5}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Provide a detailed agenda and schedule for the event (e.g., 9:00 AM - Registration, 9:30 AM - Opening Session, etc.)"
            />
            {errors.agenda && (
              <p className="mt-1 text-sm text-red-600">
                {errors.agenda.message}
              </p>
            )}
          </div>

          {/* Format */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Format <span className="text-red-500">*</span>
            </label>
            <select
              {...register("format")}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select format</option>
              <option value="Hybrid Participation">Hybrid Participation</option>
              <option value="In-person">In-person</option>
              <option value="Online">Online</option>
            </select>
            {errors.format && (
              <p className="mt-1 text-sm text-red-600">
                {errors.format.message}
              </p>
            )}
          </div>

          {/* Conditional Location Field */}
          {(selectedFormat === "Hybrid Participation" ||
            selectedFormat === "In-person") && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location <span className="text-red-500">*</span>
              </label>
              <input
                {...register("location")}
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter event location"
              />
              {errors.location && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.location.message}
                </p>
              )}
            </div>
          )}

          {/* Conditional Zoom Information Fields */}
          {(selectedFormat === "Hybrid Participation" ||
            selectedFormat === "Online") && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Zoom Information
              </h3>

              {/* Zoom Link */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Zoom Link <span className="text-red-500">*</span>
                </label>
                <input
                  {...register("zoomLink")}
                  type="url"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter Zoom meeting link"
                />
                {errors.zoomLink && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.zoomLink.message}
                  </p>
                )}
              </div>

              {/* Meeting ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Meeting ID
                </label>
                <input
                  {...register("meetingId")}
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter Meeting ID (optional)"
                />
              </div>

              {/* Passcode */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Passcode
                </label>
                <input
                  {...register("passcode")}
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter passcode (optional)"
                />
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Disclaimer Terms
            </label>
            <textarea
              {...register("disclaimer")}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter disclaimer terms and conditions"
            />
            {errors.disclaimer && (
              <p className="mt-1 text-sm text-red-600">
                {errors.disclaimer.message}
              </p>
            )}
          </div>

          {/* Role Configuration Section */}
          {selectedEventType && currentRoles.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Configure Event Roles for {selectedEventType}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Set the number of participants needed for each role. Default
                values are provided, but you can customize them. Common
                Participant roles are fixed at 25 each.
              </p>

              <div className="space-y-4">
                {currentRoles.map((role) => (
                  <div
                    key={role.name}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{role.name}</h4>
                      <p className="text-sm text-gray-600">
                        {role.description}
                      </p>
                    </div>
                    <div className="ml-4">
                      {role.name.includes("Common Participant") ? (
                        <span className="text-sm font-medium text-gray-700">
                          {role.maxParticipants} (Fixed)
                        </span>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-500">
                            Default: {role.maxParticipants}
                          </span>
                          <input
                            type="number"
                            min="0"
                            max="50"
                            defaultValue={role.maxParticipants}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-center"
                            placeholder="0"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Show message when no event type is selected */}
          {!selectedEventType && (
            <div className="bg-gray-50 rounded-lg p-6 text-center">
              <p className="text-gray-600">
                Please select an event type above to configure roles and see
                role-specific options.
              </p>
            </div>
          )}

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
