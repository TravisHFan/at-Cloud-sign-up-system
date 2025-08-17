import { Link } from "react-router-dom";
import { DashboardCard, Icon } from "../components/common";
import { Button } from "../components/ui";

export default function GetInvolved() {
  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-purple-500 to-blue-600 rounded-lg p-8 text-white">
        <div className="flex items-center mb-4">
          <Icon name="lightning" className="text-white mr-4" size="lg" />
          <h1 className="text-3xl font-bold">Get Involved at @Cloud</h1>
        </div>
        <p className="text-purple-100 text-lg leading-relaxed">
          Discover meaningful ways to engage, grow, and contribute to the @Cloud
          Marketplace Ministry community. Together, we're building careers and
          strengthening faith.
        </p>
      </div>

      {/* Main Content Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DashboardCard
          title="Join @Cloud Events"
          icon={<Icon name="calendar" className="text-blue-500" />}
        >
          <div className="space-y-4">
            <p className="text-gray-600">
              Participate in our transformative programs and workshops designed
              to advance your career and deepen your faith.
            </p>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                <div>
                  <h4 className="font-medium text-gray-900">EMBA Program</h4>
                  <p className="text-sm text-gray-600">
                    Executive MBA program combining business excellence with
                    Christian values
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                <div>
                  <h4 className="font-medium text-gray-900">
                    Seminars & Workshops
                  </h4>
                  <p className="text-sm text-gray-600">
                    Professional development sessions and skill-building
                    workshops
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                <div>
                  <h4 className="font-medium text-gray-900">
                    Mentorship Programs
                  </h4>
                  <p className="text-sm text-gray-600">
                    Connect with experienced leaders as mentees or volunteer as
                    mentors
                  </p>
                </div>
              </div>
            </div>
            <div className="pt-4 border-t border-gray-200">
              <a
                href="https://at-cloud.biz/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium"
              >
                <Icon name="chart-bar" className="mr-2" size="sm" />
                Learn more at at-cloud.biz
                <svg
                  className="ml-1 w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            </div>
          </div>
        </DashboardCard>

        <DashboardCard
          title="More Ways to Contribute"
          icon={<Icon name="user" className="text-purple-500" />}
        >
          <div className="space-y-4">
            <p className="text-gray-600">
              Explore additional opportunities to serve and grow within our
              ministry community.
            </p>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
                <div>
                  <h4 className="font-medium text-gray-900">
                    Marketplace Ministry Co-worker
                  </h4>
                  <p className="text-sm text-gray-600">
                    Join our team and help others integrate faith with their
                    professional lives
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
                <div>
                  <h4 className="font-medium text-gray-900">Event Volunteer</h4>
                  <p className="text-sm text-gray-600">
                    Support events logistics, registration, and participant
                    assistance
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
                <div>
                  <h4 className="font-medium text-gray-900">Tech Team</h4>
                  <p className="text-sm text-gray-600">
                    Contribute your technical skills to enhance our digital
                    ministry platform
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
                <div>
                  <h4 className="font-medium text-gray-900">
                    Connect with Co-workers
                  </h4>
                  <p className="text-sm text-gray-600">
                    Reach out to current team members for guidance and
                    opportunities
                  </p>
                </div>
              </div>
            </div>
            <div className="pt-4 border-t border-gray-200">
              <a
                href="https://at-cloud.biz/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-purple-600 hover:text-purple-700 font-medium"
              >
                <Icon name="chart-bar" className="mr-2" size="sm" />
                Explore opportunities
                <svg
                  className="ml-1 w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            </div>
          </div>
        </DashboardCard>
      </div>

      {/* Action Section */}
      <DashboardCard
        title="Start Your Journey"
        icon={<Icon name="lightning" className="text-yellow-500" />}
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between space-y-4 md:space-y-0">
          <div className="flex-1">
            <p className="text-gray-600 mb-2">
              Ready to take the next step? Begin by exploring current community
              events and connecting with fellow members.
            </p>
            <p className="text-sm text-gray-500">
              Join events, meet like-minded professionals, and discover your
              path within our ministry.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
            <Link to="/dashboard/upcoming">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md transition-colors duration-200 flex items-center">
                <Icon name="calendar" className="mr-2 text-white" size="sm" />
                Explore Events
              </Button>
            </Link>
            <a
              href="https://at-cloud.biz/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-md transition-colors duration-200 flex items-center justify-center">
                <svg
                  className="mr-2 w-4 h-4 text-white flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
                <span className="whitespace-nowrap">Visit @Cloud Website</span>
              </Button>
            </a>
          </div>
        </div>
      </DashboardCard>
    </div>
  );
}
