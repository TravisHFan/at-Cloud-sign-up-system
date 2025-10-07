import { Link } from "react-router-dom";
import { Button, Card, CardContent } from "../ui";

interface LoginFormWrapperProps {
  children: React.ReactNode;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
  loginAttempts: number;
  onForgotPassword: () => void;
  needsVerification?: boolean;
  userEmailForResend?: string;
  isResendingVerification?: boolean;
  onResendVerification?: () => void;
}

export default function LoginFormWrapper({
  children,
  onSubmit,
  isSubmitting,
  loginAttempts,
  onForgotPassword,
  needsVerification = false,
  userEmailForResend = "",
  isResendingVerification = false,
  onResendVerification,
}: LoginFormWrapperProps) {
  return (
    <Card>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{" "}
              <Link
                to="/signup"
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Sign up
              </Link>
            </p>
          </div>

          {children}

          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting || loginAttempts >= 5}
            loading={isSubmitting}
            className="w-full"
          >
            {isSubmitting ? "Logging in..." : "Login"}
          </Button>

          {/* Email Verification Resend Section */}
          {needsVerification && userEmailForResend && onResendVerification && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <div className="flex items-center space-x-2 mb-2">
                <svg
                  className="w-5 h-5 text-yellow-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.962-.833-2.732 0L3.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
                <h3 className="text-sm font-medium text-yellow-800">
                  Email Verification Required
                </h3>
              </div>
              <p className="text-sm text-yellow-700 mb-3">
                Please verify your email address to continue. Check your inbox
                for the verification link.
              </p>
              <p className="text-xs text-yellow-600 mb-3">
                Sending to: {userEmailForResend}
              </p>
              <Button
                type="button"
                variant="secondary"
                size="small"
                onClick={onResendVerification}
                disabled={isResendingVerification}
                loading={isResendingVerification}
                className="w-full"
              >
                {isResendingVerification
                  ? "Sending..."
                  : "Resend Verification Email"}
              </Button>
            </div>
          )}
        </form>

        <div className="mt-6">
          <div className="text-center">
            <Button variant="link" onClick={onForgotPassword}>
              Forgot your password?
            </Button>
          </div>

          {/* Guest self-registration link removed intentionally */}
        </div>
      </CardContent>
    </Card>
  );
}
