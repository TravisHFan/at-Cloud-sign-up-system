import { Link } from "react-router-dom";
import { Button, Card, CardContent } from "../ui";

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
    <Card>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-6">
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
        </form>

        <div className="mt-6 space-y-4">
          <div className="text-center">
            <Button variant="ghost" onClick={onForgotPassword}>
              Forgot your password?
            </Button>
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
      </CardContent>
    </Card>
  );
}
