import { BaseApiClient } from "./common";

/**
 * Roles Templates API Service
 * Handles role template CRUD operations for event creation
 */
class RolesTemplatesApiClient extends BaseApiClient {
  async getAllRolesTemplates(): Promise<Record<string, unknown[]>> {
    const response = await this.request<Record<string, unknown[]>>(
      "/roles-templates"
    );
    if (response.data) {
      return response.data;
    }
    throw new Error(response.message || "Failed to load role templates");
  }

  async getRolesTemplatesByEventType(eventType: string): Promise<unknown[]> {
    const response = await this.request<unknown[]>(
      `/roles-templates/event-type/${eventType}`
    );
    if (response.data) {
      return response.data;
    }
    throw new Error(response.message || "Failed to load templates");
  }

  async getRolesTemplateById(id: string): Promise<unknown> {
    const response = await this.request<unknown>(`/roles-templates/${id}`);
    if (response.data) {
      return response.data;
    }
    throw new Error(response.message || "Failed to load template");
  }

  async createRolesTemplate(payload: unknown): Promise<unknown> {
    const response = await this.request<unknown>("/roles-templates", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (response.data) {
      return response.data;
    }
    throw new Error(response.message || "Failed to create template");
  }

  async updateRolesTemplate(id: string, payload: unknown): Promise<unknown> {
    const response = await this.request<unknown>(`/roles-templates/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    if (response.data) {
      return response.data;
    }
    throw new Error(response.message || "Failed to update template");
  }

  async deleteRolesTemplate(id: string): Promise<void> {
    const response = await this.request<void>(`/roles-templates/${id}`, {
      method: "DELETE",
    });
    if (!response.success) {
      throw new Error(response.message || "Failed to delete template");
    }
  }
}

// Export singleton instance
const rolesTemplatesApiClient = new RolesTemplatesApiClient();

// Export service methods
export const rolesTemplatesService = {
  getAllRolesTemplates: () => rolesTemplatesApiClient.getAllRolesTemplates(),
  getRolesTemplatesByEventType: (eventType: string) =>
    rolesTemplatesApiClient.getRolesTemplatesByEventType(eventType),
  getRolesTemplateById: (id: string) =>
    rolesTemplatesApiClient.getRolesTemplateById(id),
  createRolesTemplate: (payload: unknown) =>
    rolesTemplatesApiClient.createRolesTemplate(payload),
  updateRolesTemplate: (id: string, payload: unknown) =>
    rolesTemplatesApiClient.updateRolesTemplate(id, payload),
  deleteRolesTemplate: (id: string) =>
    rolesTemplatesApiClient.deleteRolesTemplate(id),
};
