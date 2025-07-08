import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import toast from "react-hot-toast";

// Form validation schema
const eventSchema = yup.object().shape({
  title: yup
    .string()
    .required("Event title is required")
    .min(3, "Title must be at least 3 characters"),
  description: yup
    .string()
    .required("Event description is required")
    .min(10, "Description must be at least 10 characters"),
  date: yup.string().required("Event date is required"),
  time: yup.string().required("Event time is required"),
  location: yup.string().required("Event location is required"),
  totalSlots: yup
    .number()
    .required("Total slots is required")
    .min(1, "Must have at least 1 slot"),
  category: yup.string().required("Event category is required"),
  isOnline: yup.boolean(),
  zoomLink: yup
    .string()
    .when("isOnline", {
      is: true,
      then: (schema) =>
        schema.required("Zoom link is required for online events"),
      otherwise: (schema) => schema.notRequired(),
    }),
  requirements: yup.string(),
  materials: yup.string(),
});

interface EventFormData {
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  totalSlots: number;
  category: string;
  isOnline: boolean;
  zoomLink?: string;
  requirements?: string;
  materials?: string;
}

export default function NewEvent() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    reset,
  } = useForm<EventFormData>({
    resolver: yupResolver(eventSchema),
    defaultValues: {
      isOnline: false,
      totalSlots: 30,
    },
  });

  const watchIsOnline = watch("isOnline");
  const watchAllFields = watch();

  const onSubmit = async (data: EventFormData) => {
    setIsSubmitting(true);

    try {
      console.log("Creating event:", data);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));

      toast.success("Event created successfully!");
      reset();
      setShowPreview(false);
    } catch (error) {
      console.error("Error creating event:", error);
      toast.error("Failed to create event. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories = [
    "Workshop",
    "Seminar",
    "Training",
    "Conference",
    "Prayer Meeting",
    "Bible Study",
    "Outreach",
    "Youth Ministry",
    "Leadership",
    "Other",
  ];

  if (showPreview) {
    return (
      <div className="space-y-6">
        {/* Preview Header */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Event Preview</h1>
            <div className="flex gap-2">
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              >
                Edit Event
              </button>
              <button
                onClick={handleSubmit(onSubmit)}
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-400"
              >
                {isSubmitting ? "Creating..." : "Create Event"}
              </button>
            </div>
          </div>
          <p className="text-gray-600">
            Review your event details before creating it. You can make changes by
            clicking "Edit Event".
          </p>
        </div>

        {/* Event Preview Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
              {watchAllFields.category}
            </span>
            <span className="text-sm text-gray-500">
              {watchAllFields.totalSlots} slots available
            </span>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {watchAllFields.title}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="flex items-center text-gray-600">
              <svg
                className="w-5 h-5 mr-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              {watchAllFields.date} at {watchAllFields.time}
            </div>
            <div className="flex items-center text-gray-600">
              <svg
                className="w-5 h-5 mr-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              {watchAllFields.location}
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Description
            </h3>
            <p className="text-gray-700 leading-relaxed">
              {watchAllFields.description}
            </p>
          </div>

          {watchAllFields.isOnline && watchAllFields.zoomLink && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Online Meeting
              </h3>
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-blue-700 font-medium">Zoom Link:</p>
                <p className="text-blue-600">{watchAllFields.zoomLink}</p>
              </div>
            </div>
          )}

          {watchAllFields.requirements && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Requirements
              </h3>
              <p className="text-gray-700">{watchAllFields.requirements}</p>
            </div>
          )}

          {watchAllFields.materials && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Materials Needed
              </h3>
              <p className="text-gray-700">{watchAllFields.materials}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Create New Event
        </h1>
        <p className="text-gray-600">
          Create a new ministry event for your community. Fill in all the details
          below to help participants understand what to expect.
        </p>
      </div>

      {/* Event Form */}
      <form
        onSubmit={handleSubmit(() => setShowPreview(true))}
        className="space-y-6"
      >
        {/* Basic Information */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Basic Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Event Title *
              </label>
              <input
                {...register("title")}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.title ? "border-red-500" : "border-gray-300"
                }`}
                placeholder="Enter event title"
              />
              {errors.title && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.title.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category *
              </label>
              <select
                {...register("category")}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.category ? "border-red-500" : "border-gray-300"
                }`}
              >
                <option value="">Select a category</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              {errors.category && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.category.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Total Slots *
              </label>
              <input
                {...register("totalSlots")}
                type="number"
                min="1"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.totalSlots ? "border-red-500" : "border-gray-300"
                }`}
                placeholder="30"
              />
              {errors.totalSlots && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.totalSlots.message}
                </p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Event Description *
              </label>
              <textarea
                {...register("description")}
                rows={4}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.description ? "border-red-500" : "border-gray-300"
                }`}
                placeholder="Describe what participants can expect from this event..."
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.description.message}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Date and Time */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Date and Time
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date *
              </label>
              <input
                {...register("date")}
                type="date"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.date ? "border-red-500" : "border-gray-300"
                }`}
              />
              {errors.date && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.date.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Time *
              </label>
              <input
                {...register("time")}
                type="time"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.time ? "border-red-500" : "border-gray-300"
                }`}
              />
              {errors.time && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.time.message}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Location
          </h2>

          <div className="space-y-4">
            <div className="flex items-center">
              <input
                {...register("isOnline")}
                type="checkbox"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label className="ml-2 block text-sm text-gray-700">
                This is an online event
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location *
              </label>
              <input
                {...register("location")}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.location ? "border-red-500" : "border-gray-300"
                }`}
                placeholder={
                  watchIsOnline ? "Online / Zoom" : "Enter venue address"
                }
              />
              {errors.location && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.location.message}
                </p>
              )}
            </div>

            {watchIsOnline && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Zoom Link *
                </label>
                <input
                  {...register("zoomLink")}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.zoomLink ? "border-red-500" : "border-gray-300"
                  }`}
                  placeholder="https://zoom.us/j/..."
                />
                {errors.zoomLink && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.zoomLink.message}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Additional Information */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Additional Information
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Requirements
              </label>
              <textarea
                {...register("requirements")}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Any prerequisites or requirements for participants..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Materials Needed
              </label>
              <textarea
                {...register("materials")}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="What should participants bring or prepare..."
              />
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex flex-col sm:flex-row gap-4 justify-end">
            <button
              type="button"
              onClick={() => reset()}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              Clear Form
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Preview Event
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
