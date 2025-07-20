import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useToastReplacement } from "../contexts/NotificationModalContext";
import { Icon } from "../components/common";

export default function CheckEmail() {
  const location = useLocation();
  const notification = useToastReplacement();
  const [resendingEmail, setResendingEmail] = useState(false);
  const [emailForResend, setEmailForResend] = useState("");

  // Get email from navigation state if available
  const email = location.state?.email || "";
  const hasEmail = !!email;

  const handleResendEmail = async () => {
    setResendingEmail(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/auth/resend-verification`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email || emailForResend.trim(),
          }),
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        notification.success(
          "Verification email sent! Please check your inbox and spam folder.",
          {
            title: "Email Sent",
            autoCloseDelay: 4000,
          }
        );
      } else {
        notification.error(
          data.message ||
            "Failed to resend verification email. Please try again.",
          {
            title: "Send Failed",
          }
        );
      }
    } catch (error) {
      console.error("Error resending verification email:", error);
      notification.error(
        "Failed to resend verification email. Please try again.",
        {
          title: "Send Failed",
        }
      );
    } finally {
      setResendingEmail(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <img
            className="mx-auto h-20 w-auto"
            src="/Cloud-removebg.png"
            alt="@Cloud"
          />
          <h1 className="mt-4 text-3xl font-extrabold text-gray-900">
            Check Your Email
          </h1>
        </div>

        {/* Content */}
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-6">
              <Icon name="mail" className="h-8 w-8 text-blue-600" />
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Registration Successful!
            </h2>

            <div className="text-gray-600 space-y-4 mb-6">
              {email ? (
                <>
                  <p>
                    We've sent a verification email to{" "}
                    <span className="font-medium text-gray-900">{email}</span>
                  </p>

                  <p>
                    <strong>Before you can log in</strong>, please check your
                    email and click the verification link to activate your
                    account.
                  </p>
                </>
              ) : (
                <p>
                  <strong>Before you can log in</strong>, please check your
                  email and click the verification link to activate your
                  account.
                </p>
              )}

              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 text-sm text-yellow-800">
                <div className="flex">
                  <Icon
                    name="shield-check"
                    className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5 text-yellow-600"
                  />
                  <div>
                    Don't forget to check your <strong>spam folder</strong> if
                    you don't see the email in your inbox.
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {!email ? (
                <>
                  <div className="mb-4">
                    <label htmlFor="email" className="sr-only">
                      Email address
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      value={emailForResend}
                      onChange={(e) => setEmailForResend(e.target.value)}
                      className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                      placeholder="Enter your email address"
                    />
                  </div>
                </>
              ) : null}

              <button
                onClick={handleResendEmail}
                disabled={resendingEmail || (!email && !emailForResend.trim())}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {resendingEmail ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Sending...
                  </>
                ) : (
                  "Resend Verification Email"
                )}
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">or</span>
                </div>
              </div>

              <Link
                to="/login"
                className="w-full flex justify-center py-3 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
              >
                I've verified my email - Take me to Login
              </Link>
            </div>

            <div className="mt-6 text-xs text-gray-500">
              The verification link will expire in 24 hours
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-sm text-gray-600">
            Having trouble?{" "}
            <Link
              to="/login"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              Contact support
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
