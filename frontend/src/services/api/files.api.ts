import { BaseApiClient } from "./common";

/**
 * Files/Uploads API Service
 * Handles file upload operations for avatars and images
 */
class FilesApiClient extends BaseApiClient {
  /**
   * Upload avatar for current user
   * @param file - Avatar image file
   * @returns Avatar URL
   */
  async uploadAvatar(file: File): Promise<{ avatarUrl: string }> {
    const formData = new FormData();
    formData.append("avatar", file);

    const response = await this.request<{ avatarUrl: string }>(
      "/users/avatar",
      {
        method: "POST",
        body: formData,
      }
    );

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Failed to upload avatar");
  }

  /**
   * Upload avatar for any user (Admin only)
   * @param file - Avatar image file
   * @returns Avatar URL
   */
  async uploadAvatarForAdmin(file: File): Promise<{ avatarUrl: string }> {
    const formData = new FormData();
    formData.append("avatar", file);

    const response = await this.request<{ avatarUrl: string }>(
      "/uploads/avatar",
      {
        method: "POST",
        body: formData,
      }
    );

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Failed to upload avatar");
  }

  /**
   * Upload generic image (e.g., for events, content)
   * @param file - Image file
   * @returns Image URL
   */
  async uploadGenericImage(file: File): Promise<{ url: string }> {
    const formData = new FormData();
    formData.append("image", file);

    const response = await this.request<{ url: string }>("/uploads/image", {
      method: "POST",
      body: formData,
    });

    if (response.data) {
      return response.data;
    }

    throw new Error(response.message || "Failed to upload image");
  }
}

// Export singleton instance
const filesApiClient = new FilesApiClient();

// Export service methods
export const filesService = {
  uploadAvatar: (file: File) => filesApiClient.uploadAvatar(file),
  uploadAvatarForAdmin: (file: File) =>
    filesApiClient.uploadAvatarForAdmin(file),
  uploadGenericImage: (file: File) => filesApiClient.uploadGenericImage(file),
};

// Legacy export (singular name for backward compatibility)
export const fileService = filesService;
