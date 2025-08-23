import type { EventData } from "../../types/event";
import { Icon } from "../common";
import { getAvatarUrl, getAvatarAlt } from "../../utils/avatarUtils";
import { formatEventDateTimeRangeInViewerTZ } from "../../utils/eventStatsUtils";

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

      {/* Event Preview Card - Matching EventDetail.tsx layout */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          {eventData.title || "Untitled Event"}
        </h2>

        {/* Event Details Grid - matching EventDetail.tsx */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div className="flex items-center text-gray-600 w-full col-span-1 md:col-span-2 lg:col-span-3">
            <Icon name="calendar" className="w-5 h-5 mr-3 flex-shrink-0" />
            <span>
              {formatEventDateTimeRangeInViewerTZ(
                eventData.date,
                eventData.time,
                eventData.endTime,
                eventData.timeZone,
                (eventData as any).endDate
              )}
            </span>
            {eventData.timeZone ? (
              <span className="ml-2 text-xs text-gray-500">
                (shown in your local time)
              </span>
            ) : null}
          </div>
          <div className="flex items-center text-gray-600">
            <Icon name="map-pin" className="w-5 h-5 mr-3" />
            {eventData.location || "No Location"}
          </div>
          <div className="flex items-center text-gray-600">
            <Icon name="tag" className="w-5 h-5 mr-3" />
            Format: {eventData.format || "No Format"}
          </div>
          {/* Event Type */}
          <div className="flex items-center text-gray-600">
            <Icon name="check-circle" className="w-5 h-5 mr-3" />
            Type: {eventData.type || "No Type"}
          </div>
        </div>

        <div className="space-y-4">
          {/* Hosted by */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Hosted by
            </h3>
            <div className="flex items-center text-gray-700">
              <img
                src="/Cloud-removebg.png"
                alt="@Cloud Logo"
                className="h-6 w-auto mr-2 object-contain"
              />
              {eventData.hostedBy || "@Cloud Marketplace Ministry"}
            </div>
          </div>

          {/* Purpose */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Purpose
            </h3>
            <p className="text-gray-700">
              {eventData.purpose || "No purpose provided."}
            </p>
          </div>

          {/* Event Agenda and Schedule */}
          {eventData.agenda && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Event Agenda and Schedule
              </h3>
              <div className="text-gray-700 whitespace-pre-line">
                {eventData.agenda}
              </div>
            </div>
          )}

          {/* Organizer Contact Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Organizer Contact Information
            </h3>
            {(() => {
              const createdBy: any = (eventData as any)?.createdBy;
              const hasCreatedByDetails =
                createdBy && typeof createdBy === "object";

              if (
                !hasCreatedByDetails &&
                (!eventData.organizerDetails ||
                  eventData.organizerDetails.length === 0)
              ) {
                return (
                  <p className="text-gray-700">
                    {eventData.organizer || "No organizer specified."}
                  </p>
                );
              }

              return (
                <div className="space-y-4">
                  {hasCreatedByDetails && (
                    <div>
                      <div className="block text-sm font-medium text-gray-700 mb-2">
                        Organizer
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex items-start space-x-3 mb-3">
                          <img
                            src={getAvatarUrl(
                              createdBy.avatar || null,
                              (createdBy as any).gender || "male"
                            )}
                            alt={getAvatarAlt(
                              createdBy.firstName || "",
                              createdBy.lastName || "",
                              !!createdBy.avatar
                            )}
                            className="h-12 w-12 rounded-full object-cover flex-shrink-0"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-gray-900 mb-1">{`${
                              createdBy.firstName || ""
                            } ${createdBy.lastName || ""}`}</div>
                            <div className="text-sm text-gray-600 mb-2">
                              {(
                                createdBy.roleInAtCloud ||
                                createdBy.role ||
                                createdBy.systemAuthorizationLevel ||
                                ""
                              ).toString()}
                            </div>
                          </div>
                        </div>
                        {(createdBy.email || createdBy.phone) && (
                          <div className="space-y-1">
                            {createdBy.email && (
                              <div className="flex items-center text-sm text-gray-600">
                                <Icon
                                  name="envelope"
                                  className="w-3.5 h-3.5 mr-3"
                                />
                                <a
                                  href={`mailto:${createdBy.email}`}
                                  className="text-blue-600 hover:text-blue-800 hover:underline"
                                >
                                  {createdBy.email}
                                </a>
                              </div>
                            )}
                            {createdBy.phone && (
                              <div className="flex items-center text-sm text-gray-600">
                                <Icon
                                  name="phone"
                                  className="w-3.5 h-3.5 mr-3"
                                />
                                <a
                                  href={`tel:${createdBy.phone}`}
                                  className="text-blue-600 hover:text-blue-800 hover:underline"
                                >
                                  {createdBy.phone}
                                </a>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Co-organizers */}
                  <div>
                    <div className="block text-sm font-medium text-gray-700 mb-2">
                      Co-organizers
                    </div>
                    {eventData.organizerDetails &&
                    eventData.organizerDetails.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {eventData.organizerDetails.map((organizer, index) => (
                          <div
                            key={index}
                            className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                          >
                            <div className="flex items-start space-x-3 mb-3">
                              <img
                                src={getAvatarUrl(
                                  organizer.avatar || null,
                                  organizer.gender || "male"
                                )}
                                alt={getAvatarAlt(
                                  organizer.name.split(" ")[0] || "",
                                  organizer.name.split(" ")[1] || "",
                                  !!organizer.avatar
                                )}
                                className="h-12 w-12 rounded-full object-cover flex-shrink-0"
                              />
                              <div className="flex-1">
                                <div className="font-medium text-gray-900 mb-1">
                                  {organizer.name}
                                </div>
                                <div className="text-sm text-gray-600 mb-2">
                                  {organizer.role}
                                </div>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center text-sm text-gray-600">
                                <Icon
                                  name="envelope"
                                  className="w-3.5 h-3.5 mr-3"
                                />
                                <a
                                  href={`mailto:${organizer.email}`}
                                  className="text-blue-600 hover:text-blue-800 hover:underline"
                                >
                                  {organizer.email}
                                </a>
                              </div>
                              {organizer.phone && (
                                <div className="flex items-center text-sm text-gray-600">
                                  <Icon
                                    name="phone"
                                    className="w-3.5 h-3.5 mr-3"
                                  />
                                  <a
                                    href={`tel:${organizer.phone}`}
                                    className="text-blue-600 hover:text-blue-800 hover:underline"
                                  >
                                    {organizer.phone}
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-700">No co-organizers listed.</p>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Description */}
          {eventData.description && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Description
              </h3>
              <p className="text-gray-700">{eventData.description}</p>
            </div>
          )}

          {/* Online Meeting Link */}
          {(eventData.format === "Online" ||
            eventData.format === "Hybrid Participation") &&
            eventData.zoomLink && (
              <div>
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

          {/* Meeting Details */}
          {(eventData.format === "Online" ||
            eventData.format === "Hybrid Participation") &&
            (eventData.meetingId || eventData.passcode) && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Meeting Details
                </h3>
                <div className="space-y-1 text-gray-700">
                  {eventData.meetingId && (
                    <div className="flex items-center">
                      <span className="font-medium w-24">Meeting ID:</span>
                      <span className="font-mono">{eventData.meetingId}</span>
                    </div>
                  )}
                  {eventData.passcode && (
                    <div className="flex items-center">
                      <span className="font-medium w-24">Passcode:</span>
                      <span className="font-mono">{eventData.passcode}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

          {/* Requirements */}
          {eventData.requirements && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Requirements
              </h3>
              <p className="text-gray-700">{eventData.requirements}</p>
            </div>
          )}

          {/* Materials Needed */}
          {eventData.materials && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Materials Needed
              </h3>
              <p className="text-gray-700">{eventData.materials}</p>
            </div>
          )}

          {/* Disclaimer */}
          {eventData.disclaimer && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Disclaimer
              </h3>
              <p className="text-gray-700">{eventData.disclaimer}</p>
            </div>
          )}

          {/* Event Capacity */}
          {eventData.totalSlots && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Event Capacity
              </h3>
              <div className="flex items-center text-gray-700">
                <Icon name="user" className="w-5 h-5 mr-2" />
                <span>
                  {eventData.totalSlots} total slots available
                  {eventData.signedUp !== undefined && (
                    <span className="text-gray-500 ml-2">
                      ({eventData.signedUp} currently signed up)
                    </span>
                  )}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Event Roles Preview */}
        {eventData.roles && eventData.roles.length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Available Roles ({eventData.roles.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {eventData.roles.map((role, index) => (
                <div
                  key={role.id || index}
                  className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900">{role.name}</h4>
                    <span className="text-sm text-gray-500">
                      0/{role.maxParticipants} spots
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{role.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
