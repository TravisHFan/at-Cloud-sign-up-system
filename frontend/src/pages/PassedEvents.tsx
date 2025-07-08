export default function PassedEvents() {
  // Mock data - this will come from API later
  const mockEvents = [
    {
      id: 1,
      title: "Effective Communication Workshop Series",
      date: "2025-07-01",
      time: "19:00",
      location: "Conference Room A / Zoom",
      organizer: "John Doe",
      signedUp: 45,
      totalSlots: 50,
      status: "Completed"
    },
    {
      id: 2,
      title: "Effective Communication Workshop Series",
      date: "2025-06-24",
      time: "19:00",
      location: "Conference Room B / Zoom",
      organizer: "Jane Smith",
      signedUp: 38,
      totalSlots: 50,
      status: "Completed"
    }
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Passed Events</h1>
        <p className="text-gray-600 mb-6">
          Review completed events and their attendance records.
        </p>
      </div>

      <div className="grid gap-4">
        {mockEvents.map((event) => (
          <div
            key={event.id}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 opacity-75"
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  {event.title}
                </h3>
                <div className="space-y-1 text-sm text-gray-500">
                  <p>📅 {event.date} at {event.time}</p>
                  <p>📍 {event.location}</p>
                  <p>👤 Organizer: {event.organizer}</p>
                  <p>✅ {event.signedUp}/{event.totalSlots} attended</p>
                </div>
              </div>
              <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm">
                {event.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}