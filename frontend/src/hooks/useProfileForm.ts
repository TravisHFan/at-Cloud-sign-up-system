import { useState, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useAuth } from "./useAuth";
import { userService, fileService } from "../services/api";
import type { ProfileFormData } from "../schemas/profileSchema";
import { useToastReplacement } from "../contexts/NotificationModalContext";
import { formatFileSize } from "../utils/imageCompression";
import { getAvatarUrlWithCacheBust } from "../utils/avatarUtils";
import type { AuthUser } from "../types";

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
        // Start empty so the placeholder is selected by default until user chooses
        gender: "" as unknown as ProfileFormData["gender"],
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

  const { reset, control } = form;
  const watchedValues = useWatch({ control });

  // Update form when currentUser changes. 'reset' is stable per RHF docs.
  useEffect(() => {
    if (currentUser) {
      const newData: ProfileFormData = {
        firstName: currentUser.firstName,
        lastName: currentUser.lastName,
        username: currentUser.username,
        email: currentUser.email,
        gender:
          (currentUser.gender as unknown as ProfileFormData["gender"]) ?? "",
        phone: currentUser.phone || "",
        isAtCloudLeader: currentUser.isAtCloudLeader,
        roleInAtCloud: currentUser.roleInAtCloud || "",
        homeAddress: currentUser.homeAddress || "",
        occupation: currentUser.occupation || "",
        company: currentUser.company || "",
        weeklyChurch: currentUser.weeklyChurch || "",
        churchAddress: currentUser.churchAddress || "",
      };

      reset(newData);
    }
  }, [currentUser, reset]);

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
    reset(userData);
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

    // Skip frontend compression - let backend handle it for better quality
    setSelectedAvatarFile(file);
    setAvatarPreview(previewUrl);

    const originalSize = formatFileSize(file.size);
    notification.success(
      `Avatar selected! Size: ${originalSize}. Backend will optimize during upload. Click "Save Changes" to upload.`,
      {
        title: "Avatar Selected",
        autoCloseDelay: 4000,
      }
    );
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

        // Clear the preview and update with new avatar URL
        setAvatarPreview(null);
      }

      // Transform data for backend API
      const apiData = {
        ...data,
        // Convert isAtCloudLeader from "Yes"/"No" string to boolean
        isAtCloudLeader: data.isAtCloudLeader === "Yes",
      };

      // Update user profile via backend API
      const updatedUser = await userService.updateProfile(apiData);

      // Build a normalized patch for AuthContext (AuthUser shape)
      const finalAvatar = getAvatarUrlWithCacheBust(
        avatarUrl || null,
        (updatedUser.gender as "male" | "female") || currentUser.gender
      );

      const normalizedPatch: Partial<AuthUser> = {
        id: updatedUser.id ?? currentUser.id,
        username: updatedUser.username ?? currentUser.username,
        firstName: updatedUser.firstName ?? currentUser.firstName,
        lastName: updatedUser.lastName ?? currentUser.lastName,
        email: updatedUser.email ?? currentUser.email,
        phone: updatedUser.phone ?? currentUser.phone,
        role: (updatedUser.role as AuthUser["role"]) ?? currentUser.role,
        isAtCloudLeader: updatedUser.isAtCloudLeader ? "Yes" : "No",
        roleInAtCloud:
          updatedUser.roleInAtCloud ??
          (data.isAtCloudLeader === "Yes" ? data.roleInAtCloud : ""),
        gender: (updatedUser.gender as "male" | "female") ?? currentUser.gender,
        avatar: finalAvatar,
        weeklyChurch: updatedUser.weeklyChurch ?? currentUser.weeklyChurch,
        churchAddress: updatedUser.churchAddress ?? currentUser.churchAddress,
        homeAddress: updatedUser.homeAddress ?? currentUser.homeAddress,
        occupation: updatedUser.occupation ?? currentUser.occupation,
        company: updatedUser.company ?? currentUser.company,
      };

      // Update auth context with normalized values
      updateUser(normalizedPatch);

      // Also immediately sync the form values so UI reflects changes without waiting
      const newFormValues: ProfileFormData = {
        firstName: normalizedPatch.firstName || currentUser.firstName,
        lastName: normalizedPatch.lastName || currentUser.lastName,
        username: normalizedPatch.username || currentUser.username,
        email: normalizedPatch.email || currentUser.email,
        gender:
          (normalizedPatch.gender as "male" | "female") || currentUser.gender,
        phone: normalizedPatch.phone || currentUser.phone || "",
        isAtCloudLeader:
          normalizedPatch.isAtCloudLeader || currentUser.isAtCloudLeader,
        roleInAtCloud:
          normalizedPatch.roleInAtCloud ||
          (data.isAtCloudLeader === "Yes" ? data.roleInAtCloud || "" : ""),
        homeAddress:
          normalizedPatch.homeAddress || currentUser.homeAddress || "",
        occupation: normalizedPatch.occupation || currentUser.occupation || "",
        company: normalizedPatch.company || currentUser.company || "",
        weeklyChurch:
          normalizedPatch.weeklyChurch || currentUser.weeklyChurch || "",
        churchAddress:
          normalizedPatch.churchAddress || currentUser.churchAddress || "",
      };
      reset(newFormValues);

      setIsEditing(false);
      setSelectedAvatarFile(null); // Clear selected file
      setAvatarPreview(null); // Clear avatar preview so it uses the new uploaded avatar
      notification.success("Profile updated successfully!", {
        title: "Profile Saved",
        autoCloseDelay: 3000,
      });
    } catch (error: unknown) {
      console.error("Profile update failed:", error);
      notification.error(
        (error as { message?: string })?.message || "Failed to update profile",
        {
          title: "Update Failed",
        }
      );
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
