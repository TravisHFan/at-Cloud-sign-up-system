import { Link } from "react-router-dom";

export default function GetInvolved() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">
          Get Involved at @Cloud
        </h1>
        <p className="text-gray-600">
          Here are ways to engage and grow with the @Cloud community.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-2">
            Participate in @Cloud Events
          </h2>
          <ul className="list-disc list-inside text-gray-700 space-y-1">
            <li>EMBA Program, seminars, and workshops</li>
            <li>Join as mentees or volunteers</li>
          </ul>
          <div className="mt-4">
            <a
              href="https://at-cloud.biz/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Learn more at https://at-cloud.biz/
            </a>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-2">
            Alternative Ways to Get Involved
          </h2>
          <ul className="list-disc list-inside text-gray-700 space-y-1">
            <li>Join the @Cloud Marketplace Ministry as a co-worker</li>
            <li>
              Participate in @Cloud Events (e.g., EMBA Program) to become
              mentees
            </li>
            <li>Volunteer at events or join the tech team</li>
            <li>Ask current co-workers for more information</li>
          </ul>
          <div className="mt-4">
            <a
              href="https://at-cloud.biz/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Visit https://at-cloud.biz/
            </a>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-2">Next Steps</h2>
        <p className="text-gray-700">
          You can also explore community events right now.
        </p>
        <div className="mt-3">
          <Link
            to="/dashboard/upcoming"
            className="text-blue-600 hover:underline"
          >
            Explore Community Events
          </Link>
        </div>
      </div>
    </div>
  );
}
