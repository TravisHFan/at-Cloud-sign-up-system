import { BaseApiClient } from "./common";
import type { ApiResponse } from "./common/types";

/**
 * Assignments API Service
 * Handles role assignment rejection flow (public, token-based endpoints)
 */
class AssignmentsApiClient extends BaseApiClient {
  /**
   * Validate a role assignment rejection token (public endpoint)
   * @param token - Rejection token from email
   * @returns Event and role information associated with the token
   */
  async validateAssignmentRejection(token: string): Promise<
    ApiResponse<{
      event?: {
        id: string;
        title?: string;
        date?: string;
        time?: string;
        roleName?: string;
      };
      role?: string;
    }>
  > {
    return this.request(
      `/role-assignments/reject/validate?token=${encodeURIComponent(token)}`
    );
  }

  /**
   * Submit rejection for a role assignment (public endpoint)
   * @param token - Rejection token from email
   * @param note - Optional note explaining rejection reason
   * @returns Status confirmation
   */
  async rejectAssignment(
    token: string,
    note: string
  ): Promise<ApiResponse<{ status: string }>> {
    return this.request(`/role-assignments/reject/reject`, {
      method: "POST",
      body: JSON.stringify({ token, note }),
    });
  }
}

// Export singleton instance
const assignmentsApiClient = new AssignmentsApiClient();

// Export service methods
export const assignmentsService = {
  validateRejection: (token: string) =>
    assignmentsApiClient.validateAssignmentRejection(token),
  submitRejection: (token: string, note: string) =>
    assignmentsApiClient.rejectAssignment(token, note),
};

// Legacy export (singular name for backward compatibility)
export const assignmentService = assignmentsService;
