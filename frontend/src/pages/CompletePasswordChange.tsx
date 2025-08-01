import { useCompletePasswordChange } from "../hooks/useCompletePasswordChange";
import { PageHeader, Card, CardContent } from "../components/ui";
import { useNavigate } from "react-router-dom";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

export default function CompletePasswordChange() {
  const navigate = useNavigate();
  const { isLoading, isSuccess, error } = useCompletePasswordChange();

  // Loading state
  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <PageHeader
          title="Completing Password Change"
          subtitle="Please wait while we process your request."
        />

        <Card>
          <CardContent className="text-center py-12">
            <div className="flex flex-col items-center space-y-6">
              <div className="flex items-center justify-center w-16 h-16">
                <ArrowPathIcon className="w-8 h-8 text-blue-600 animate-spin" />
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900">
                  Processing Password Change
                </h3>
                <p className="text-gray-600">
                  We're securely updating your password. This will only take a
                  moment.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (isSuccess) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <PageHeader
          title="Password Changed Successfully"
          subtitle="Your password has been updated securely."
        />

        <Card>
          <CardContent className="text-center py-12">
            <div className="flex flex-col items-center space-y-6">
              <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full">
                <CheckCircleIcon className="w-8 h-8 text-green-600" />
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900">
                  Password Updated Successfully!
                </h3>
                <p className="text-gray-600 max-w-md">
                  Your account password has been changed successfully. You can
                  now use your new password to log in.
                </p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4 max-w-md">
                <div className="text-sm text-green-800">
                  <p className="font-medium mb-1">Security Notice</p>
                  <p>
                    For your security, you've received email confirmation and
                    system notifications about this password change. If you
                    didn't make this change, please contact support immediately.
                  </p>
                </div>
              </div>

              <div className="text-sm text-gray-500">
                <p>You'll be redirected to your profile page shortly.</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => navigate("/dashboard/profile")}
                  className="px-6 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Go to Profile
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/dashboard")}
                  className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Go to Dashboard
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <PageHeader
          title="Password Change Failed"
          subtitle="There was an issue processing your password change request."
        />

        <Card>
          <CardContent className="text-center py-12">
            <div className="flex flex-col items-center space-y-6">
              <div className="flex items-center justify-center w-16 h-16 bg-red-100 rounded-full">
                <ExclamationTriangleIcon className="w-8 h-8 text-red-600" />
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900">
                  Unable to Change Password
                </h3>
                <p className="text-gray-600 max-w-md">{error}</p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-md">
                <div className="text-sm text-yellow-800">
                  <p className="font-medium mb-1">Common Issues</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>
                      The password change link may have expired (links expire
                      after 10 minutes)
                    </li>
                    <li>The link may have already been used</li>
                    <li>The link may be invalid or corrupted</li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => navigate("/dashboard/change-password")}
                  className="px-6 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Request New Change
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/dashboard/profile")}
                  className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Back to Profile
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invalid token state (shouldn't normally reach here due to useEffect in hook)
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        title="Invalid Password Change Link"
        subtitle="This password change link is not valid."
      />

      <Card>
        <CardContent className="text-center py-12">
          <div className="flex flex-col items-center space-y-6">
            <div className="flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full">
              <ExclamationTriangleIcon className="w-8 h-8 text-gray-600" />
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-900">
                Invalid Link
              </h3>
              <p className="text-gray-600">
                This password change link is not valid. Please request a new
                password change.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate("/dashboard/change-password")}
              className="px-6 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Request Password Change
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
