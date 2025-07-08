import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

// Login validation schema
const loginSchema = yup.object({
  username: yup.string().required("Username is required"),
  password: yup.string().required("Password is required"),
});

type LoginFormData = yup.InferType<typeof loginSchema>;

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: yupResolver(loginSchema),
  });

  const {
    register: registerForgot,
    handleSubmit: handleSubmitForgot,
    formState: { errors: forgotErrors },
  } = useForm<{ email: string }>({
    resolver: yupResolver(
      yup.object({
        email: yup
          .string()
          .email("Invalid email")
          .required("Email is required"),
      })
    ),
  });

  const onSubmit = async (data: LoginFormData) => {
    if (loginAttempts >= 5) {
      toast.error("Too many failed attempts. Please try password recovery.");
      return;
    }

    setIsSubmitting(true);

    try {
      console.log("Login data:", data);

      // Simulate API call for login
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Simulate login failure for demonstration (remove in production)
      const isLoginSuccessful = Math.random() > 0.5; // 50% chance of success for demo

      if (isLoginSuccessful) {
        toast.success("Login successful!");
        // Redirect to dashboard
        navigate("/dashboard");
      } else {
        const newAttempts = loginAttempts + 1;
        setLoginAttempts(newAttempts);

        if (newAttempts >= 5) {
          toast.error(
            "Maximum login attempts reached. Please use password recovery."
          );
        } else {
          toast.error(
            `Invalid credentials. ${5 - newAttempts} attempts remaining.`
          );
        }
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Login failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onForgotPasswordSubmit = async (data: { email: string }) => {
    setIsSubmitting(true);

    try {
      console.log("Password recovery email:", data.email);

      // Simulate API call for password recovery
      await new Promise((resolve) => setTimeout(resolve, 1000));

      toast.success("Password recovery email sent! Please check your inbox.");
      setShowForgotPassword(false);
      setLoginAttempts(0); // Reset attempts after password recovery
    } catch (error) {
      console.error("Password recovery error:", error);
      toast.error("Failed to send recovery email. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showForgotPassword) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <div className="flex justify-center">
              <img
                className="h-12 w-auto"
                src="/@Cloud.jpg"
                alt="@Cloud Logo"
              />
            </div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Reset your password
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Enter your email address and we'll send you a link to reset your
              password.
            </p>
          </div>

          <div className="bg-white shadow-md rounded-lg p-6 sm:p-8">
            <form
              onSubmit={handleSubmitForgot(onForgotPasswordSubmit)}
              className="space-y-6"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  {...registerForgot("email")}
                  type="email"
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    forgotErrors.email ? "border-red-500" : "border-gray-300"
                  }`}
                  placeholder="Enter your email address"
                />
                {forgotErrors.email && (
                  <p className="mt-1 text-sm text-red-600">
                    {forgotErrors.email.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? "Sending..." : "Send Recovery Email"}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => setShowForgotPassword(false)}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                ← Back to Login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="flex justify-center">
            <img className="h-12 w-auto" src="/@Cloud.jpg" alt="@Cloud Logo" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Login to @Cloud
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Welcome back to @Cloud Marketplace Ministry
          </p>
        </div>

        <div className="bg-white shadow-md rounded-lg p-6 sm:p-8">
          {loginAttempts >= 5 && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-red-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Maximum login attempts reached
                  </h3>
                  <p className="mt-1 text-sm text-red-700">
                    Please use password recovery to reset your account.
                  </p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>
              <input
                {...register("username")}
                type="text"
                disabled={loginAttempts >= 5}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.username ? "border-red-500" : "border-gray-300"
                } ${
                  loginAttempts >= 5 ? "bg-gray-100 cursor-not-allowed" : ""
                }`}
                placeholder="Enter your username"
              />
              {errors.username && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.username.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  {...register("password")}
                  type={showPassword ? "text" : "password"}
                  disabled={loginAttempts >= 5}
                  className={`w-full px-3 py-2 pr-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.password ? "border-red-500" : "border-gray-300"
                  } ${
                    loginAttempts >= 5 ? "bg-gray-100 cursor-not-allowed" : ""
                  }`}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loginAttempts >= 5}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed"
                >
                  {showPassword ? (
                    <EyeSlashIcon className="w-5 h-5" />
                  ) : (
                    <EyeIcon className="w-5 h-5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.password.message}
                </p>
              )}
            </div>

            {loginAttempts > 0 && loginAttempts < 5 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <p className="text-sm text-yellow-800">
                  Warning: {loginAttempts} failed attempt
                  {loginAttempts > 1 ? "s" : ""}. {5 - loginAttempts} attempt
                  {5 - loginAttempts > 1 ? "s" : ""} remaining.
                </p>
              </div>
            )}

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
                onClick={() => setShowForgotPassword(true)}
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
      </div>
    </div>
  );
}
