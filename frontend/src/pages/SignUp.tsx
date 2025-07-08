import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { signUpSchema } from "../schemas/signUpSchema";
import type { SignUpFormData } from "../schemas/signUpSchema";
import PasswordField from "../components/forms/PasswordField";
import ConfirmPasswordField from "../components/forms/ConfirmPasswordField";

export default function SignUp() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<SignUpFormData>({
    resolver: yupResolver<SignUpFormData, any, any>(signUpSchema),
    defaultValues: {
      isAtCloudLeader: "false",
    },
  });

  const password = watch("password");
  const isAtCloudLeader = watch("isAtCloudLeader");

  const onSubmit = async (data: SignUpFormData) => {
    setIsSubmitting(true);

    try {
      console.log("Sign up data:", data);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      toast.success(
        "Registration successful! Please check your email to verify your account."
      );

      if (data.isAtCloudLeader === "true") {
        console.log("Sending email to Owner about Leader role request");
        toast.success(
          "Your Leader role request has been sent to the Owner for review."
        );
      }

      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (error) {
      console.error("Sign up error:", error);
      toast.error("Registration failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full space-y-8">
        <div>
          <div className="flex justify-center">
            <img className="h-12 w-auto" src="/@Cloud.jpg" alt="@Cloud Logo" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign up for @Cloud
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Join the @Cloud Marketplace Ministry
          </p>
        </div>

        <div className="bg-white shadow-md rounded-lg p-6 sm:p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Username *
              </label>
              <input
                {...register("username")}
                type="text"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.username ? "border-red-500" : "border-gray-300"
                }`}
                placeholder="Enter your username"
              />
              {errors.username && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.username.message}
                </p>
              )}
            </div>

            {/* Password Fields - Now using extracted components */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <PasswordField
                register={register}
                errors={errors}
                password={password}
                showStrengthIndicator={true}
              />
              <ConfirmPasswordField register={register} errors={errors} />
            </div>

            {/* Personal Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  First Name *
                </label>
                <input
                  {...register("firstName")}
                  type="text"
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.firstName ? "border-red-500" : "border-gray-300"
                  }`}
                  placeholder="Enter your first name"
                />
                {errors.firstName && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.firstName.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name *
                </label>
                <input
                  {...register("lastName")}
                  type="text"
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.lastName ? "border-red-500" : "border-gray-300"
                  }`}
                  placeholder="Enter your last name"
                />
                {errors.lastName && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.lastName.message}
                  </p>
                )}
              </div>
            </div>

            {/* Gender */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Gender *
              </label>
              <select
                {...register("gender")}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.gender ? "border-red-500" : "border-gray-300"
                }`}
              >
                <option value="">Select Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
              {errors.gender && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.gender.message}
                </p>
              )}
            </div>

            {/* Contact Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email *
                </label>
                <input
                  {...register("email")}
                  type="email"
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.email ? "border-red-500" : "border-gray-300"
                  }`}
                  placeholder="Enter your email address"
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone (Optional)
                </label>
                <input
                  {...register("phone")}
                  type="tel"
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.phone ? "border-red-500" : "border-gray-300"
                  }`}
                  placeholder="Enter your phone number"
                />
                {errors.phone && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.phone.message}
                  </p>
                )}
              </div>
            </div>

            {/* @Cloud Leader Question */}
            <div className="border rounded-lg p-4 bg-blue-50">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Are you an @Cloud Leader? *
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    {...register("isAtCloudLeader")}
                    type="radio"
                    value="true"
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Yes</span>
                </label>
                <label className="flex items-center">
                  <input
                    {...register("isAtCloudLeader")}
                    type="radio"
                    value="false"
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">No</span>
                </label>
              </div>
              {errors.isAtCloudLeader && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.isAtCloudLeader.message}
                </p>
              )}
            </div>

            {/* Role in @Cloud (only show if user selected "Yes" to being a Leader) */}
            {isAtCloudLeader === "true" && ( // Fix: Compare with string 'true'
              <div className="border rounded-lg p-4 bg-green-50">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  What is your role in @Cloud? *
                </label>
                <textarea
                  {...register("roleInAtCloud")}
                  rows={3}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.roleInAtCloud ? "border-red-500" : "border-gray-300"
                  }`}
                  placeholder="Please describe your role in @Cloud organization (e.g., Founder, CFO, Event Director, IT Director, etc.)"
                />
                {errors.roleInAtCloud && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.roleInAtCloud.message}
                  </p>
                )}
                <p className="mt-2 text-sm text-blue-600">
                  Note: The Admin will receive an email notification about your
                  Leader role request.
                </p>
              </div>
            )}

            {/* Optional Fields */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Home Address (Optional)
              </label>
              <textarea
                {...register("homeAddress")}
                rows={3}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.homeAddress ? "border-red-500" : "border-gray-300"
                }`}
                placeholder="Enter your home address"
              />
              {errors.homeAddress && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.homeAddress.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company (Optional)
              </label>
              <input
                {...register("company")}
                type="text"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.company ? "border-red-500" : "border-gray-300"
                }`}
                placeholder="Enter your company name"
              />
              {errors.company && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.company.message}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? "Creating Account..." : "Sign Up"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{" "}
              <Link
                to="/login"
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
