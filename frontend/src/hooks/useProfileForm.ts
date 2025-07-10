import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import toast from "react-hot-toast";
import {
  profileSchema,
  type ProfileFormData,
  type UserData,
} from "../schemas/profileSchema";
import { MOCK_USER_DATA } from "../config/profileConstants";
import { getAvatarUrl } from "../utils/avatarUtils";

export function useProfileForm() {
  const [isEditing, setIsEditing] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  // Mock user data - this will come from auth context later
  const [userData, setUserData] = useState<UserData>(MOCK_USER_DATA);

  // Initialize avatar preview with user's avatar or gender-specific default
  const [avatarPreview, setAvatarPreview] = useState<string>(
    userData.avatar || getAvatarUrl(null, userData.gender as "male" | "female")
  );

  const form = useForm<ProfileFormData>({
    resolver: yupResolver<ProfileFormData, any, any>(profileSchema),
    defaultValues: userData,
  });

  const { handleSubmit, reset, watch } = form;

  const onSubmit = async (data: ProfileFormData) => {
    try {
      console.log("Updating profile:", data);
      if (avatarFile) {
        console.log("New avatar file:", avatarFile);
      }

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Update user data
      const updatedData = {
        ...userData,
        ...data,
        avatar: avatarPreview,
      };
      setUserData(updatedData);

      toast.success("Profile updated successfully!");
      setIsEditing(false);
      setAvatarFile(null);
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile. Please try again.");
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    reset(userData);
    setAvatarPreview(
      userData.avatar ||
        getAvatarUrl(null, userData.gender as "male" | "female")
    );
  };

  const handleCancel = () => {
    setIsEditing(false);
    reset(userData);
    setAvatarPreview(
      userData.avatar ||
        getAvatarUrl(null, userData.gender as "male" | "female")
    );
    setAvatarFile(null);
  };

  const handleAvatarChange = (file: File, previewUrl: string) => {
    setAvatarFile(file);
    setAvatarPreview(previewUrl);
  };

  return {
    // Form state
    form,
    isEditing,
    userData,

    // Avatar state
    avatarFile,
    avatarPreview,

    // Watched values
    watchedValues: watch(),

    // Actions
    onSubmit: handleSubmit(onSubmit),
    handleEdit,
    handleCancel,
    handleAvatarChange,
  };
}
