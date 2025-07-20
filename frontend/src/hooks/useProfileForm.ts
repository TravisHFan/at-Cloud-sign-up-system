import { useState, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useAuth } from "./useAuth";
import { userService, fileService } from "../services/api";
import type { ProfileFormData } from "../schemas/profileSchema";
import { useToastReplacement } from "../contexts/NotificationModalContext";
import {
  compressImage,
  formatFileSize,
  getCompressionRatio,
} from "../utils/imageCompression";

export function useProfileForm() {
  const { currentUser, updateUser } = useAuth();
  const notification = useToastReplacement();
  const [isEditing, setIsEditing] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  // Convert AuthUser to ProfileFormData format
  const userData: ProfileFormData = currentUser
    ? {
        firstName: currentUser.firstName,
        lastName: currentUser.lastName,
        username: currentUser.username,
        email: currentUser.email,
        gender: currentUser.gender,
        phone: currentUser.phone || "",
        isAtCloudLeader: currentUser.isAtCloudLeader, // Already string ("Yes" or "No")
        roleInAtCloud: currentUser.roleInAtCloud || "",
        homeAddress: currentUser.homeAddress || "",
        occupation: currentUser.occupation || "",
        company: currentUser.company || "",
        weeklyChurch: currentUser.weeklyChurch || "",
        churchAddress: currentUser.churchAddress || "",
      }
    : {
        firstName: "",
        lastName: "",
        username: "",
        email: "",
        gender: "male" as const,
        phone: "",
        isAtCloudLeader: "No",
        roleInAtCloud: "",
        homeAddress: "",
        occupation: "",
        company: "",
        weeklyChurch: "",
        churchAddress: "",
      };

  const form = useForm<ProfileFormData>({
    defaultValues: userData,
    mode: "onChange",
  });

  const watchedValues = useWatch({ control: form.control });

  // Update form when currentUser changes
  useEffect(() => {
    if (currentUser) {
      const newData: ProfileFormData = {
        firstName: currentUser.firstName,
        lastName: currentUser.lastName,
        username: currentUser.username,
        email: currentUser.email,
        gender: currentUser.gender,
        phone: currentUser.phone || "",
        isAtCloudLeader: currentUser.isAtCloudLeader,
        roleInAtCloud: currentUser.roleInAtCloud || "",
        homeAddress: currentUser.homeAddress || "",
        occupation: currentUser.occupation || "",
        company: currentUser.company || "",
        weeklyChurch: currentUser.weeklyChurch || "",
        churchAddress: currentUser.churchAddress || "",
      };

      form.reset(newData);
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
    setSelectedAvatarFile(null); // Clear selected file
  };

  const handleAvatarChange = (file: File, previewUrl: string) => {
    // Validate file size (10MB limit to match backend)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
      notification.error(
        `File is too large. Maximum size is ${Math.round(
          maxSize / (1024 * 1024)
        )}MB.`,
        {
          title: "File Too Large",
        }
      );
      return;
    }

    // Validate file type
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    if (!allowedTypes.includes(file.type)) {
      notification.error(
        "Please select a valid image file (JPEG, PNG, GIF, or WebP).",
        {
          title: "Invalid File Type",
        }
      );
      return;
    }

    // Compress image before storing
    compressImage(file)
      .then((compressedFile) => {
        setSelectedAvatarFile(compressedFile);
        setAvatarPreview(previewUrl);

        const originalSize = formatFileSize(file.size);
        const compressedSize = formatFileSize(compressedFile.size);
        const compressionRatio = getCompressionRatio(
          file.size,
          compressedFile.size
        );

        notification.success(
          `Avatar selected and compressed! Original: ${originalSize} → Compressed: ${compressedSize} (${compressionRatio}% reduction). Click "Save Changes" to upload.`,
          {
            title: "Image Optimized",
            autoCloseDelay: 4000,
          }
        );
      })
      .catch((error) => {
        console.error("Image compression failed:", error);
        // Fallback to original file if compression fails
        setSelectedAvatarFile(file);
        setAvatarPreview(previewUrl);
        notification.success(
          'Avatar selected! Click "Save Changes" to upload.'
        );
      });
  };

  const onSubmit = async (data: ProfileFormData) => {
    if (!currentUser) return;

    setLoading(true);
    try {
      let avatarUrl = currentUser.avatar;

      // Upload avatar if a new file was selected
      if (selectedAvatarFile) {
        const uploadResult = await fileService.uploadAvatar(selectedAvatarFile);
        avatarUrl = uploadResult.avatarUrl;
      }

      // Transform data for backend API
      const apiData = {
        ...data,
        // Convert isAtCloudLeader from "Yes"/"No" string to boolean
        isAtCloudLeader: data.isAtCloudLeader === "Yes",
      };

      // Update user profile via backend API
      const updatedUser = await userService.updateProfile(apiData);

      // Update auth context with new data including avatar
      updateUser({
        ...updatedUser,
        avatar: avatarUrl,
      });

      setIsEditing(false);
      setSelectedAvatarFile(null); // Clear selected file
      notification.success("Profile updated successfully!", {
        title: "Profile Saved",
        autoCloseDelay: 3000,
      });
    } catch (error: any) {
      console.error("Profile update failed:", error);
      notification.error(error.message || "Failed to update profile", {
        title: "Update Failed",
      });
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
