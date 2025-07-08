import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import toast from "react-hot-toast";
import type { SubmitHandler } from "react-hook-form";

// Profile form validation schema
const profileSchema = yup.object({
  username: yup
    .string()
    .required("Username is required")
    .min(3, "Username must be at least 3 characters"),
  firstName: yup.string().required("First name is required"),
  lastName: yup.string().required("Last name is required"),
  gender: yup
    .string()
    .required("Gender is required")
    .oneOf(["male", "female"], "Please select a valid gender"),
  email: yup.string().email("Invalid email").required("Email is required"),
  phone: yup.string().notRequired(),
  roleInAtCloud: yup.string().required("Role in @Cloud is required"),
  atCloudRole: yup.string().required("@Cloud role is required"),
  homeAddress: yup.string().notRequired(),
  company: yup.string().notRequired(),
});

type ProfileFormData = yup.InferType<typeof profileSchema>;

export default function Profile() {
  const [isEditing, setIsEditing] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>(
    "/api/placeholder/120/120"
  );

  // Mock user data - this will come from auth context later
  const [userData, setUserData] = useState<
    ProfileFormData & { avatar: string; systemRole: string }
  >({
    username: "john_doe",
    firstName: "John",
    lastName: "Doe",
    gender: "male",
    email: "john@example.com",
    phone: "+1234567890",
    roleInAtCloud: "Software Engineer", // What they do professionally
    atCloudRole: "Regular Participant", // Their role in @Cloud organization
    homeAddress: "123 Main St, City, State 12345",
    company: "Tech Company Inc.",
    avatar: "/api/placeholder/120/120",
    systemRole: "Administrator", // This determines access level
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<ProfileFormData>({
    resolver: yupResolver<ProfileFormData, any, any>(profileSchema),
    defaultValues: userData,
  });

  const currentAtCloudRole = watch("atCloudRole");

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setAvatarPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit: SubmitHandler<ProfileFormData> = async (data) => {
    try {
      console.log("Profile data:", data);
      console.log("Avatar file:", avatarFile);

      // Check if user changed @Cloud role to "I'm an @Cloud Leader"
      if (
        userData.systemRole === "User" &&
        userData.atCloudRole === "Regular Participant" &&
        data.atCloudRole === "I'm an @Cloud Leader"
      ) {
        console.log("Sending email to Owner and Admins about role change");
        toast.success(
          "Profile updated! Owner and Admins have been notified of your role change."
        );
      } else {
        toast.success("Profile updated successfully!");
      }

      // Update local state
      setUserData((prev) => ({
        ...prev,
        ...Object.fromEntries(
          Object.entries(data).map(([key, value]) => [
            key,
            value === null ? "" : value,
          ])
        ),
      }));
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile. Please try again.");
    }
  };

  const handleCancel = () => {
    reset(userData);
    setIsEditing(false);
    setAvatarPreview(userData.avatar);
    setAvatarFile(null);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Edit Profile
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <form
          onSubmit={handleSubmit(onSubmit as SubmitHandler<ProfileFormData>)}
          className="space-y-6"
        >
          {/* Avatar Section */}
          <div className="flex items-center space-x-6">
            <div className="relative">
              <img
                src={avatarPreview}
                alt="Profile Avatar"
                className="w-24 h-24 rounded-full border-4 border-gray-300 object-cover"
              />
              {isEditing && (
                <label className="absolute bottom-0 right-0 bg-blue-600 text-white rounded-full p-2 cursor-pointer hover:bg-blue-700 transition-colors">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {userData.firstName} {userData.lastName}
              </h3>
              <p className="text-sm text-gray-500">@{userData.username}</p>
              <p className="text-sm text-gray-500">{userData.systemRole}</p>
            </div>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Username *
              </label>
              <input
                {...register("username")}
                type="text"
                disabled={!isEditing}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  !isEditing ? "bg-gray-50 text-gray-500" : "border-gray-300"
                } ${errors.username ? "border-red-500" : ""}`}
              />
              {errors.username && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.username.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email *
              </label>
              <input
                {...register("email")}
                type="email"
                disabled={!isEditing}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  !isEditing ? "bg-gray-50 text-gray-500" : "border-gray-300"
                } ${errors.email ? "border-red-500" : ""}`}
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                First Name *
              </label>
              <input
                {...register("firstName")}
                type="text"
                disabled={!isEditing}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  !isEditing ? "bg-gray-50 text-gray-500" : "border-gray-300"
                } ${errors.firstName ? "border-red-500" : ""}`}
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
                disabled={!isEditing}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  !isEditing ? "bg-gray-50 text-gray-500" : "border-gray-300"
                } ${errors.lastName ? "border-red-500" : ""}`}
              />
              {errors.lastName && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.lastName.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Gender *
              </label>
              <select
                {...register("gender")}
                disabled={!isEditing}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  !isEditing ? "bg-gray-50 text-gray-500" : "border-gray-300"
                } ${errors.gender ? "border-red-500" : ""}`}
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone (Optional)
              </label>
              <input
                {...register("phone")}
                type="tel"
                disabled={!isEditing}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  !isEditing ? "bg-gray-50 text-gray-500" : "border-gray-300"
                } ${errors.phone ? "border-red-500" : ""}`}
              />
              {errors.phone && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.phone.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role in @Cloud *
              </label>
              <input
                {...register("roleInAtCloud")}
                type="text"
                disabled={!isEditing}
                placeholder="e.g., Software Engineer, Teacher, Student"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  !isEditing ? "bg-gray-50 text-gray-500" : "border-gray-300"
                } ${errors.roleInAtCloud ? "border-red-500" : ""}`}
              />
              {errors.roleInAtCloud && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.roleInAtCloud.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                @Cloud Role *
              </label>
              <select
                {...register("atCloudRole")}
                disabled={!isEditing}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  !isEditing ? "bg-gray-50 text-gray-500" : "border-gray-300"
                } ${errors.atCloudRole ? "border-red-500" : ""}`}
              >
                <option value="Regular Participant">Regular Participant</option>
                <option value="I'm an @Cloud Leader">
                  I'm an @Cloud Leader
                </option>
              </select>
              {errors.atCloudRole && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.atCloudRole.message}
                </p>
              )}
              {isEditing &&
                userData.systemRole === "User" &&
                userData.atCloudRole === "Regular Participant" &&
                currentAtCloudRole === "I'm an @Cloud Leader" && (
                  <p className="mt-1 text-sm text-blue-600">
                    Note: Owner and Admins will be notified of this role change.
                  </p>
                )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Home Address (Optional)
            </label>
            <textarea
              {...register("homeAddress")}
              disabled={!isEditing}
              rows={3}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                !isEditing ? "bg-gray-50 text-gray-500" : "border-gray-300"
              } ${errors.homeAddress ? "border-red-500" : ""}`}
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
              disabled={!isEditing}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                !isEditing ? "bg-gray-50 text-gray-500" : "border-gray-300"
              } ${errors.company ? "border-red-500" : ""}`}
            />
            {errors.company && (
              <p className="mt-1 text-sm text-red-600">
                {errors.company.message}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          {isEditing && (
            <div className="flex space-x-4">
              <button
                type="submit"
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Save Changes
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="bg-gray-300 text-gray-700 px-6 py-2 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancel
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
