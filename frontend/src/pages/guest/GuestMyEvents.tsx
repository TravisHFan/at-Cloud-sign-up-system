import { Link } from "react-router-dom";

export default function GuestMyEvents() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 text-blue-600 text-3xl">
          📒
        </div>
        <h1 className="text-2xl font-bold text-gray-900">
          Create an account to manage your events
        </h1>
        <p className="text-gray-600">
          Guests can browse and sign up for events. To view your registrations,
          keep records, and manage changes, please sign up for a free account.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link
          to="/signup"
          className="inline-flex items-center justify-center rounded-md bg-blue-600 px-5 py-3 text-white font-medium shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Sign up to manage My Events
        </Link>

        <Link
          to="/guest-dashboard/upcoming"
          className="inline-flex items-center justify-center rounded-md border border-gray-300 px-5 py-3 text-gray-700 font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Keep browsing upcoming events
        </Link>
      </div>

      <div className="mt-10 border border-gray-200 rounded-lg p-6 bg-white">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          Why create an account?
        </h2>
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          <li>View all your registrations in one place</li>
          <li>Update or cancel your spot when plans change</li>
          <li>See past event history and notes</li>
          <li>Get helpful reminders and updates</li>
        </ul>
      </div>
    </div>
  );
}
