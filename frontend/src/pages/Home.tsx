import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="text-center max-w-md w-full -mt-16">
        {/* Added -mt-16 for upward offset */}
        <div className="flex justify-center mb-6">
          <img
            className="h-16 w-auto"
            src="/Cloud-removebg.png"
            alt="@Cloud Logo"
          />
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Welcome to @Cloud
        </h1>
        <p className="text-xl text-gray-600 mb-8">Event Sign-up System</p>
        <div className="space-x-4">
          <Link
            to="/login"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Login
          </Link>
          <Link
            to="/signup"
            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}
