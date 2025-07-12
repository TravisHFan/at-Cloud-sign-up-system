import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import toast from "react-hot-toast";
import {
  profileSchema,
  type ProfileFormData,
  type UserData,
} from "../schemas/profileSchema";
import { CURRENT_USER } from "../data/mockUserData";
import { getAvatarUrl } from "../utils/avatarUtils";
import { emailNotificationService } from "../utils/emailNotificationService";
import { systemMessageIntegration } from "../utils/systemMessageIntegration";

export function useProfileForm() {
  const [isEditing, setIsEditing] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  // Convert MockUser to UserData format
  const convertMockUserToUserData = (
    mockUser: typeof CURRENT_USER
  ): UserData => ({
    id: mockUser.id,
    username: mockUser.username,
    firstName: mockUser.firstName,
    lastName: mockUser.lastName,
    email: mockUser.email,
    gender: mockUser.gender,
    phone: mockUser.phone || "",
    roleInAtCloud: mockUser.roleInAtCloud || "",
    isAtCloudLeader: mockUser.isAtCloudLeader,
    homeAddress: mockUser.homeAddress || "",
    company: mockUser.company || "",
    weeklyChurch: mockUser.weeklyChurch || "",
    churchAddress: mockUser.churchAddress || "",
    avatar: mockUser.avatar || null,
    systemAuthorizationLevel:
      mockUser.systemAuthorizationLevel || mockUser.role,
  });

  // Mock user data - this will come from auth context later
  const [userData, setUserData] = useState<UserData>(
    convertMockUserToUserData(CURRENT_USER)
  );

  // Initialize avatar preview with user's avatar or gender-specific default
  const [avatarPreview, setAvatarPreview] = useState<string>(
    userData.avatar || getAvatarUrl(null, userData.gender as "male" | "female")
  );

  const form = useForm<ProfileFormData>({
    resolver: yupResolver(profileSchema) as any,
    defaultValues: userData,
  });

  const { handleSubmit, reset, watch } = form;

  const onSubmit = async (data: ProfileFormData) => {
    try {
      console.log("Updating profile:", data);
      if (avatarFile) {
        console.log("New avatar file:", avatarFile);
      }

      // Check if user changed from "No" to "Yes" for @Cloud Leader
      const wasNotLeader = userData.isAtCloudLeader === "No";
      const isNowLeader = data.isAtCloudLeader === "Yes";
      const becameLeader = wasNotLeader && isNowLeader;

      if (
        becameLeader &&
        data.roleInAtCloud &&
        data.roleInAtCloud.trim() !== ""
      ) {
        try {
          await emailNotificationService.sendLeaderStatusChangeNotification({
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            roleInAtCloud: data.roleInAtCloud,
          });

          // Send system message for leader status change (message from leader)
          systemMessageIntegration.sendLeaderStatusChangeSystemMessage({
            id: userData.id,
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            roleInAtCloud: data.roleInAtCloud,
          });

          toast.success(
            "Profile updated! Super Admin and Administrators have been notified of your Leader role request.",
            { duration: 5000 }
          );
        } catch (emailError) {
          console.error("Failed to send admin notification:", emailError);
          toast.success(
            "Profile updated successfully! However, admin notification may have failed."
          );
        }
      } else if (becameLeader) {
        toast.success(
          "Profile updated! Please also specify your role in @Cloud to complete your Leader request."
        );
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

      if (!becameLeader) {
        toast.success("Profile updated successfully!");
      }
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
