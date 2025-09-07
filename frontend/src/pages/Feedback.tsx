import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import {
  ExclamationTriangleIcon,
  LightBulbIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "../hooks/useAuth";
import { apiClient } from "../services/api";
import { useToastReplacement } from "../contexts/NotificationModalContext";
import { getAvatarUrl } from "../utils/avatarUtils";

// Feedback schema
const feedbackSchema = yup.object({
  type: yup
    .string()
    .oneOf(["bug", "improvement", "general"], "Please select a feedback type")
    .required("Please select a feedback type"),
  subject: yup
    .string()
    .min(5, "Subject must be at least 5 characters")
    .max(200, "Subject must be less than 200 characters")
    .required("Subject is required"),
  message: yup
    .string()
    .min(10, "Message must be at least 10 characters")
    .max(2000, "Message must be less than 2000 characters")
    .required("Message is required"),
  includeContact: yup.boolean().default(false),
});

type FeedbackForm = yup.InferType<typeof feedbackSchema>;

export default function Feedback() {
  const { currentUser } = useAuth();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { success, error } = useToastReplacement();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    reset,
  } = useForm<FeedbackForm>({
    resolver: yupResolver(feedbackSchema),
    defaultValues: {
      type: "general",
      includeContact: false,
    },
  });

  const watchedMessage = watch("message", "");
  const watchedType = watch("type", "general");

  const onSubmit = async (data: FeedbackForm) => {
    try {
      // Use the new submitFeedback method
      await apiClient.submitFeedback(data);

      setIsSubmitted(true);
      success(
        "Feedback submitted successfully! Thank you for helping us improve."
      );
      reset();
    } catch (err) {
      console.error("Failed to submit feedback:", err);
      error("Failed to submit feedback. Please try again.");
    }
  };

  const getFeedbackTypeIcon = (type: string) => {
    switch (type) {
      case "bug":
        return <ExclamationTriangleIcon className="w-5 h-5" />;
      case "improvement":
        return <LightBulbIcon className="w-5 h-5" />;
      case "general":
        return <ChatBubbleLeftRightIcon className="w-5 h-5" />;
      default:
        return <ChatBubbleLeftRightIcon className="w-5 h-5" />;
    }
  };

  const getFeedbackTypeDescription = (type: string) => {
    switch (type) {
      case "bug":
        return "Found something that's not working as expected? Let us know!";
      case "improvement":
        return "Have ideas to make our system even better? We'd love to hear them!";
      case "general":
        return "Questions, compliments, or anything else on your mind.";
      default:
        return "";
    }
  };

  const getFeedbackTypeColor = (type: string) => {
    switch (type) {
      case "bug":
        return "text-red-600 bg-red-50 border-red-200 hover:bg-red-100";
      case "improvement":
        return "text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100";
      case "general":
        return "text-green-600 bg-green-50 border-green-200 hover:bg-green-100";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200 hover:bg-gray-100";
    }
  };

  if (isSubmitted) {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-8">
        <div className="text-center">
          <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Thank you for your feedback!
          </h2>
          <p className="text-gray-600 mb-6">
            Your message has been sent to our team. We'll review it and get back
            to you if needed.
          </p>
          <button
            onClick={() => setIsSubmitted(false)}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Send Another Feedback
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Feedback</h1>
        <p className="text-gray-600">
          Help us improve @Cloud by sharing your thoughts, reporting bugs, or
          suggesting new features.
        </p>
      </div>

      {/* User Info Display */}
      {currentUser && (
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            Feedback from:
          </h3>
          <div className="flex items-center space-x-3">
            <img
              className="w-10 h-10 rounded-full object-cover"
              src={getAvatarUrl(
                currentUser.avatar || null,
                (currentUser.gender ?? "female") as "male" | "female"
              )}
              alt={`${currentUser.firstName} ${currentUser.lastName}`}
            />
            <div>
              <p className="font-medium text-gray-900">
                {currentUser.firstName} {currentUser.lastName}
              </p>
              <p className="text-sm text-gray-600">{currentUser.email}</p>
              {currentUser.roleInAtCloud && (
                <p className="text-xs text-gray-500">
                  {currentUser.roleInAtCloud}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Feedback Type Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            What type of feedback do you have?
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {["bug", "improvement", "general"].map((type) => (
              <label
                key={type}
                className={`relative flex cursor-pointer rounded-lg border p-4 focus:outline-none ${
                  watchedType === type
                    ? getFeedbackTypeColor(type)
                    : "border-gray-200 bg-white hover:bg-gray-50"
                }`}
              >
                <input
                  {...register("type")}
                  type="radio"
                  value={type}
                  className="sr-only"
                />
                <div className="flex items-center">
                  <div className="mr-3">{getFeedbackTypeIcon(type)}</div>
                  <div>
                    <div className="font-medium capitalize">{type} Report</div>
                    <div className="text-xs mt-1">
                      {getFeedbackTypeDescription(type)}
                    </div>
                  </div>
                </div>
              </label>
            ))}
          </div>
          {errors.type && (
            <p className="mt-2 text-sm text-red-600">{errors.type.message}</p>
          )}
        </div>

        {/* Subject */}
        <div>
          <label
            htmlFor="subject"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Subject
          </label>
          <input
            {...register("subject")}
            type="text"
            id="subject"
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            placeholder="Brief summary of your feedback"
          />
          {errors.subject && (
            <p className="mt-2 text-sm text-red-600">
              {errors.subject.message}
            </p>
          )}
        </div>

        {/* Message */}
        <div>
          <label
            htmlFor="message"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Message
          </label>
          <textarea
            {...register("message")}
            id="message"
            rows={6}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            placeholder="Please provide detailed information about your feedback..."
          />
          <div className="mt-2 flex justify-between">
            {errors.message && (
              <p className="text-sm text-red-600">{errors.message.message}</p>
            )}
            <p className="text-sm text-gray-500 ml-auto">
              {watchedMessage.length}/2000 characters
            </p>
          </div>
        </div>

        {/* Include Contact Info */}
        <div className="flex items-center">
          <input
            {...register("includeContact")}
            id="includeContact"
            type="checkbox"
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label
            htmlFor="includeContact"
            className="ml-2 block text-sm text-gray-700"
          >
            I'm okay with the team contacting me about this feedback
          </label>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => reset()}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Clear Form
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {isSubmitting ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Submitting...
              </>
            ) : (
              "Submit Feedback"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
