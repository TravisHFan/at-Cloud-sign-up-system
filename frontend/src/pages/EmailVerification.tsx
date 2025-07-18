import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Icon } from "../components/common";

export default function EmailVerification() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [verificationStatus, setVerificationStatus] = useState<
    "verifying" | "success" | "error" | "expired"
  >("verifying");
  const [resendingEmail, setResendingEmail] = useState(false);

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token) {
        setVerificationStatus("error");
        return;
      }

      try {

        // Simulate API call to verify email
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Real backend email verification
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/auth/verify-email`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ token }),
          }
        );

        const data = await response.json();

        if (response.ok && data.success) {
          setVerificationStatus("success");
          toast.success("Email verified successfully! You can now log in.");
        } else if (
          data.message?.includes("expired") ||
          data.error?.includes("expired")
        ) {
          setVerificationStatus("expired");
        } else {
          setVerificationStatus("error");
        }
      } catch (error) {
        console.error("Email verification error:", error);
        setVerificationStatus("error");
      }
    };

    verifyEmail();
  }, [token]);

  const handleResendEmail = async () => {
    setResendingEmail(true);

    try {

      // Simulate API call to resend verification email
      await new Promise((resolve) => setTimeout(resolve, 1500));

      toast.success("Verification email sent! Please check your inbox.");
    } catch (error) {
      console.error("Error resending verification email:", error);
      toast.error("Failed to resend verification email. Please try again.");
    } finally {
      setResendingEmail(false);
    }
  };

  const handleLoginRedirect = () => {
    navigate("/login");
  };

  const renderContent = () => {
    switch (verificationStatus) {
      case "verifying":
        return (
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-6"></div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Verifying Your Email
            </h2>
            <p className="text-gray-600">
              Please wait while we verify your email address...
            </p>
          </div>
        );

      case "success":
        return (
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
              <Icon name="check-circle" className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Email Verified Successfully!
            </h2>
            <p className="text-gray-600 mb-6">
              Your email has been verified. You can now log in to your @Cloud
              account.
            </p>
            <button
              onClick={handleLoginRedirect}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
            >
              Go to Login
            </button>
          </div>
        );

      case "expired":
        return (
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-yellow-100 mb-6">
              <Icon name="clock" className="h-8 w-8 text-yellow-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Verification Link Expired
            </h2>
            <p className="text-gray-600 mb-6">
              Your verification link has expired. Please request a new
              verification email.
            </p>
            <button
              onClick={handleResendEmail}
              disabled={resendingEmail}
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
          </div>
        );

      case "error":
      default:
        return (
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-6">
              <Icon name="x-circle" className="h-8 w-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Verification Failed
            </h2>
            <p className="text-gray-600 mb-6">
              We couldn't verify your email address. The link may be invalid or
              expired.
            </p>
            <div className="space-y-3">
              <button
                onClick={handleResendEmail}
                disabled={resendingEmail}
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
              <Link
                to="/signup"
                className="w-full flex justify-center py-3 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
              >
                Back to Sign Up
              </Link>
            </div>
          </div>
        );
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
            Email Verification
          </h1>
        </div>

        {/* Content */}
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {renderContent()}
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-sm text-gray-600">
            Need help?{" "}
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
