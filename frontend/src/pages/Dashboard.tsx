export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Welcome to @Cloud!
        </h1>
        <p className="text-gray-600">
          Use the sidebar to navigate to different sections.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Upcoming Events
          </h2>
          <p className="text-gray-600">View and manage upcoming events</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Passed Events
          </h2>
          <p className="text-gray-600">Review completed events</p>
        </div>
      </div>
    </div>
  );
}
