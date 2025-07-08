import { Link } from "react-router-dom";

interface LoginFormWrapperProps {
  children: React.ReactNode;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
  loginAttempts: number;
  onForgotPassword: () => void;
}

export default function LoginFormWrapper({
  children,
  onSubmit,
  isSubmitting,
  loginAttempts,
  onForgotPassword,
}: LoginFormWrapperProps) {
  return (
    <div className="bg-white shadow-md rounded-lg p-6 sm:p-8">
      <form onSubmit={onSubmit} className="space-y-6">
        {children}

        <button
          type="submit"
          disabled={isSubmitting || loginAttempts >= 5}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? "Logging in..." : "Login"}
        </button>
      </form>

      <div className="mt-6 space-y-4">
        <div className="text-center">
          <button
            onClick={onForgotPassword}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            Forgot your password?
          </button>
        </div>

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
      </div>
    </div>
  );
}