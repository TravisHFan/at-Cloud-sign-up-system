import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useAuth } from "../hooks/useAuth";
import OrganizerSelection from "../components/events/OrganizerSelection";
import { fileService } from "../services/api";

interface Mentor {
  id: string;
  firstName: string;
  lastName: string;
  systemAuthorizationLevel: string;
  roleInAtCloud?: string;
  gender: "male" | "female";
  avatar: string | null;
  email: string;
  phone?: string;
}

interface ProgramFormData {
  programType: string;
  title: string;
  startYear: string;
  startMonth: string;
  endYear: string;
  endMonth: string;
  hostedBy: string;
  introduction: string;
  flyerUrl?: string;
  flyer?: FileList;
}

const PROGRAM_TYPES = [
  "EMBA Mentor Circles",
  "Effective Communication Workshops",
];

// Generate years from current year to 5 years in the future
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => (currentYear + i).toString());

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function CreateNewProgram() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedMentors, setSelectedMentors] = useState<Mentor[]>([]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProgramFormData>({
    defaultValues: {
      hostedBy: "@Cloud Marketplace Ministry",
      startYear: currentYear.toString(),
      endYear: currentYear.toString(),
    },
  });

  const selectedProgramType = watch("programType");
  const isEMBACircle = selectedProgramType === "EMBA Mentor Circles";

  const handleMentorsChange = (mentors: Mentor[]) => {
    setSelectedMentors(mentors);
  };

  const onSubmit = async (data: ProgramFormData) => {
    try {
      setIsSubmitting(true);
      console.log("Creating program:", data);
      console.log("Selected mentors:", selectedMentors);
      // TODO: Implement program creation API call
      // await programService.createProgram({ ...data, mentors: selectedMentors });

      // For now, just navigate back to programs page
      navigate("/dashboard/programs");
    } catch (error) {
      console.error("Failed to create program:", error);
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleCancel = () => {
    navigate("/dashboard/programs");
  };

  // Check if user needs the restricted access overlay (Participant or Guest Expert)
  const shouldShowRestrictedOverlay =
    currentUser?.role === "Participant" || currentUser?.role === "Guest Expert";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div
        className={`relative bg-white rounded-lg shadow-sm p-6 ${
          shouldShowRestrictedOverlay ? "bg-gray-50" : ""
        }`}
      >
        {shouldShowRestrictedOverlay && (
          <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[1px] rounded-lg flex flex-col items-center justify-center text-center p-6">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 max-w-md mx-auto">
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mb-4 mx-auto">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Create Program access requires @Cloud Co‑worker authorization
              </h2>
              <p className="text-sm text-gray-600">
                To create new programs, you'll need elevated permissions. Please
                contact your @Cloud Leaders to request access.
              </p>
            </div>
          </div>
        )}

        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Create New Program
        </h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Program Type */}
          <div>
            <label
              htmlFor="programType"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Program Type <span className="text-red-500">*</span>
            </label>
            <select
              id="programType"
              {...register("programType", {
                required: "Program type is required",
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select program type</option>
              {PROGRAM_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            {errors.programType && (
              <p className="mt-1 text-sm text-red-600">
                {errors.programType.message}
              </p>
            )}
          </div>

          {/* Title */}
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Program Title <span className="text-red-500">*</span>
            </label>
            <input
              id="title"
              {...register("title", { required: "Program title is required" })}
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter program title"
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-600">
                {errors.title.message}
              </p>
            )}
          </div>

          {/* Start Year and Month */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
            <div>
              <label
                htmlFor="startYear"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Start Year <span className="text-red-500">*</span>
              </label>
              <select
                id="startYear"
                {...register("startYear", {
                  required: "Start year is required",
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select year</option>
                {YEARS.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              {errors.startYear && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.startYear.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="startMonth"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Start Month <span className="text-red-500">*</span>
              </label>
              <select
                id="startMonth"
                {...register("startMonth", {
                  required: "Start month is required",
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select month</option>
                {MONTHS.map((month) => (
                  <option key={month} value={month}>
                    {month}
                  </option>
                ))}
              </select>
              {errors.startMonth && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.startMonth.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="endYear"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                End Year <span className="text-red-500">*</span>
              </label>
              <select
                id="endYear"
                {...register("endYear", { required: "End year is required" })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select year</option>
                {YEARS.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              {errors.endYear && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.endYear.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="endMonth"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                End Month <span className="text-red-500">*</span>
              </label>
              <select
                id="endMonth"
                {...register("endMonth", { required: "End month is required" })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select month</option>
                {MONTHS.map((month) => (
                  <option key={month} value={month}>
                    {month}
                  </option>
                ))}
              </select>
              {errors.endMonth && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.endMonth.message}
                </p>
              )}
            </div>
          </div>

          {/* Hosted By */}
          <div>
            <label
              htmlFor="hostedBy"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Hosted By
            </label>
            <input
              id="hostedBy"
              {...register("hostedBy")}
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 cursor-not-allowed"
              readOnly
            />
            <p className="mt-1 text-sm text-gray-500">
              This field cannot be changed
            </p>
          </div>

          {/* Mentors - Use OrganizerSelection component for EMBA Mentor Circles */}
          {currentUser && isEMBACircle && (
            <OrganizerSelection
              mainOrganizer={{
                id: currentUser.id,
                firstName: currentUser.firstName,
                lastName: currentUser.lastName,
                systemAuthorizationLevel: currentUser.role,
                roleInAtCloud: currentUser.roleInAtCloud,
                gender: currentUser.gender,
                avatar: currentUser.avatar || null,
                email: currentUser.email,
                phone: currentUser.phone,
              }}
              currentUserId={currentUser.id}
              selectedOrganizers={selectedMentors}
              onOrganizersChange={handleMentorsChange}
            />
          )}

          {/* Program Introduction */}
          <div>
            <label
              htmlFor="introduction"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Program Introduction <span className="text-red-500">*</span>
            </label>
            <textarea
              id="introduction"
              {...register("introduction", {
                required: "Program introduction is required",
              })}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Provide a detailed introduction to the program..."
            />
            {errors.introduction && (
              <p className="mt-1 text-sm text-red-600">
                {errors.introduction.message}
              </p>
            )}
          </div>

          {/* Program Flyer (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Program Flyer
            </label>
            <div className="flex items-center gap-3">
              <input
                type="url"
                {...register("flyerUrl")}
                placeholder="https://... or /uploads/images/your-file.png"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <label
                className="px-3 py-2 border rounded-md cursor-pointer hover:bg-gray-50"
                title="Upload image"
              >
                📎
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const inputEl = e.currentTarget;
                    const file = inputEl.files?.[0];
                    if (!file) return;
                    try {
                      const { url } = await fileService.uploadImage(file);
                      setValue("flyerUrl", url, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    } catch (err) {
                      console.error("Flyer upload failed", err);
                      alert("Failed to upload image");
                    } finally {
                      inputEl.value = "";
                    }
                  }}
                />
              </label>
            </div>
            {watch("flyerUrl") && (
              <div className="mt-3">
                <img
                  src={watch("flyerUrl")}
                  alt="Program flyer preview"
                  className="w-full max-w-2xl h-auto rounded border border-gray-200 object-contain"
                />
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex flex-col sm:flex-row gap-3 sm:justify-end pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating..." : "Create Program"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
