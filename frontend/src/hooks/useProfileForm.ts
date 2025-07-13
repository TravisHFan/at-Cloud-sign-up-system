import { useState, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useAuth } from "./useAuth";
import { userService } from "../services/api";
import toast from "react-hot-toast";

// Define profile form data based on AuthUser
interface UserProfileFormData {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  gender: "male" | "female";
  isAtCloudLeader: boolean;
  roleInAtCloud?: string;
  weeklyChurch?: string;
  churchAddress?: string;
  occupation?: string;
}

export function useProfileForm() {
  const { currentUser, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Convert AuthUser to UserProfileFormData format
  const userData: UserProfileFormData = currentUser
    ? {
        firstName: currentUser.firstName,
        lastName: currentUser.lastName,
        username: currentUser.username,
        email: currentUser.email,
        gender: currentUser.gender,
        isAtCloudLeader: currentUser.isAtCloudLeader === "Yes",
        roleInAtCloud: currentUser.roleInAtCloud || "",
        weeklyChurch: currentUser.weeklyChurch || "",
        churchAddress: currentUser.churchAddress || "",
        occupation: currentUser.occupation || "",
      }
    : {
        firstName: "",
        lastName: "",
        username: "",
        email: "",
        gender: "male" as const,
        isAtCloudLeader: false,
        roleInAtCloud: "",
        weeklyChurch: "",
        churchAddress: "",
        occupation: "",
      };

  const form = useForm<UserProfileFormData>({
    defaultValues: userData,
    mode: "onChange",
  });

  const watchedValues = useWatch({ control: form.control });

  // Update form when currentUser changes
  useEffect(() => {
    if (currentUser) {
      form.reset(userData);
    }
  }, [currentUser, form]);

  // Set avatar preview from current user
  useEffect(() => {
    if (currentUser?.avatar) {
      setAvatarPreview(currentUser.avatar);
    }
  }, [currentUser?.avatar]);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    form.reset(userData);
    setAvatarPreview(currentUser?.avatar || null);
  };

  const handleAvatarChange = (file: File | null) => {
    if (file) {
      const url = URL.createObjectURL(file);
      setAvatarPreview(url);
    } else {
      setAvatarPreview(currentUser?.avatar || null);
    }
  };

  const onSubmit = async (data: UserProfileFormData) => {
    if (!currentUser) return;

    setLoading(true);
    try {
      // Update user profile via backend API
      const updatedUser = await userService.updateProfile(data);

      // Update auth context
      updateUser(updatedUser);

      setIsEditing(false);
      toast.success("Profile updated successfully!");
    } catch (error: any) {
      console.error("Profile update failed:", error);
      toast.error(error.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  return {
    // Form state
    form,
    isEditing,
    userData,
    loading,

    // Avatar state
    avatarPreview,

    // Watched values
    watchedValues,

    // Actions
    onSubmit: form.handleSubmit(onSubmit),
    handleEdit,
    handleCancel,
    handleAvatarChange,
  };
}
