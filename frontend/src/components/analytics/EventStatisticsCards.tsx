export interface EventStats {
  totalSlots: number;
  signedUp: number;
  fillRate: number;
  availableSlots?: number;
}

export interface EventStatisticsCardsProps {
  upcomingEvents: number;
  upcomingStats: EventStats;
  passedEvents: number;
  passedStats: EventStats;
}

export function EventStatisticsCards({
  upcomingEvents,
  upcomingStats,
  passedEvents,
  passedStats,
}: EventStatisticsCardsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Upcoming Events
        </h3>
        <div className="space-y-4">
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Total Events:</span>
            <span className="font-medium">{upcomingEvents}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Total Slots:</span>
            <span className="font-medium">{upcomingStats.totalSlots}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Signed Up:</span>
            <span className="font-medium text-green-600">
              {upcomingStats.signedUp}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Available:</span>
            <span className="font-medium text-blue-600">
              {upcomingStats.availableSlots}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Fill Rate:</span>
            <span className="font-medium">
              {upcomingStats.fillRate.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full"
              style={{
                width: `${upcomingStats.fillRate}%`,
              }}
            />
          </div>
        </div>
      </div>
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Past Events
        </h3>
        <div className="space-y-4">
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Total Events:</span>
            <span className="font-medium">{passedEvents}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Total Slots:</span>
            <span className="font-medium">{passedStats.totalSlots}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Total Signups:</span>
            <span className="font-medium text-green-600">
              {passedStats.signedUp}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Fill Rate:</span>
            <span className="font-medium">
              {passedStats.fillRate.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full"
              style={{
                width: `${passedStats.fillRate}%`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
