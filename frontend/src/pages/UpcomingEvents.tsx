export default function UpcomingEvents() {
  // Mock data - this will come from API later
  const mockEvents = [
    {
      id: 1,
      title: "Effective Communication Workshop Series",
      date: "2025-07-15",
      time: "19:00",
      location: "Conference Room A / Zoom",
      organizer: "John Doe",
      signedUp: 28,
      totalSlots: 50
    },
    {
      id: 2,
      title: "Effective Communication Workshop Series",
      date: "2025-07-22",
      time: "19:00",
      location: "Conference Room B / Zoom",
      organizer: "Jane Smith",
      signedUp: 15,
      totalSlots: 50
    }
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Upcoming Events</h1>
        <p className="text-gray-600 mb-6">
          Click on any event to view details and sign up for roles.
        </p>
      </div>

      <div className="grid gap-4">
        {mockEvents.map((event) => (
          <div
            key={event.id}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {event.title}
                </h3>
                <div className="space-y-1 text-sm text-gray-600">
                  <p>📅 {event.date} at {event.time}</p>
                  <p>📍 {event.location}</p>
                  <p>👤 Organizer: {event.organizer}</p>
                  <p>✅ {event.signedUp}/{event.totalSlots} signed up</p>
                </div>
              </div>
              <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                View Details →
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}