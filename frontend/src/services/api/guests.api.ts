import { BaseApiClient, type GuestSummary } from "./common";
import type { EventData } from "../../types/event";

/**
 * Guest Registration API Service
 * Handles guest signup, management, self-service operations, and invitation decline
 */
class GuestsApiClient extends BaseApiClient {
  // ========== Organizer/Admin: Guest Management ==========

  /**
   * Guest signup for an event
   */
  async guestSignup(
    eventId: string,
    payload: {
      fullName: string;
      gender?: "male" | "female";
      email: string;
      phone?: string;
      notes?: string;
      roleId: string;
    }
  ): Promise<{ registrationId: string }> {
    const res = await this.request<{ registrationId: string }>(
      `/events/${eventId}/guest-signup`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
    return res.data as { registrationId: string };
  }

  /**
   * Get all guests for an event
   */
  async getEventGuests(eventId: string): Promise<{ guests: GuestSummary[] }> {
    const res = await this.request<{ guests: GuestSummary[] }>(
      `/events/${eventId}/guests`
    );
    return (res.data as { guests: GuestSummary[] }) || { guests: [] };
  }

  /**
   * Re-send manage link to a guest (event-scoped)
   */
  async resendGuestManageLinkForEvent(
    eventId: string,
    guestRegistrationId: string
  ): Promise<void> {
    await this.request(
      `/events/${eventId}/manage/guests/${guestRegistrationId}/resend-manage-link`,
      { method: "POST" }
    );
  }

  /**
   * Re-send manage link to a guest (admin-only legacy endpoint)
   */
  async resendGuestManageLink(guestRegistrationId: string): Promise<void> {
    await this.request(
      `/guest-registrations/${guestRegistrationId}/resend-manage-link`,
      { method: "POST" }
    );
  }

  /**
   * Update guest registration (event-scoped)
   */
  async updateGuestRegistrationForEvent(
    eventId: string,
    guestRegistrationId: string,
    payload: { fullName?: string; phone?: string; notes?: string }
  ): Promise<unknown> {
    const res = await this.request<unknown>(
      `/events/${eventId}/manage/guests/${guestRegistrationId}`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      }
    );
    return res.data;
  }

  /**
   * Update guest registration (admin-only legacy endpoint)
   */
  async updateGuestRegistration(
    guestRegistrationId: string,
    payload: { fullName?: string; phone?: string; notes?: string }
  ): Promise<unknown> {
    const res = await this.request<unknown>(
      `/guest-registrations/${guestRegistrationId}`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      }
    );
    return res.data;
  }

  /**
   * Cancel guest registration (event-scoped)
   */
  async cancelGuestRegistrationForEvent(
    eventId: string,
    guestRegistrationId: string,
    reason?: string
  ): Promise<unknown> {
    const res = await this.request<unknown>(
      `/events/${eventId}/manage/guests/${guestRegistrationId}`,
      {
        method: "DELETE",
        body: JSON.stringify({ reason }),
      }
    );
    return res.data;
  }

  /**
   * Cancel guest registration (admin-only legacy endpoint)
   */
  async cancelGuestRegistration(
    guestRegistrationId: string,
    reason?: string
  ): Promise<unknown> {
    const res = await this.request<unknown>(
      `/guest-registrations/${guestRegistrationId}`,
      {
        method: "DELETE",
        body: JSON.stringify({ reason }),
      }
    );
    return res.data;
  }

  /**
   * Move guest between roles
   */
  async moveGuestBetweenRoles(
    eventId: string,
    guestRegistrationId: string,
    fromRoleId: string,
    toRoleId: string
  ): Promise<EventData> {
    const response = await this.request<{ event: EventData }>(
      `/events/${eventId}/manage/move-guest`,
      {
        method: "POST",
        body: JSON.stringify({
          guestRegistrationId,
          fromRoleId,
          toRoleId,
        }),
      }
    );

    if (response.data) {
      return response.data.event;
    }

    throw new Error(response.message || "Failed to move guest between roles");
  }

  // ========== Guest Self-Service (Token-Based) ==========

  /**
   * Get guest info by manage token
   */
  async getGuestByToken(token: string): Promise<unknown> {
    const res = await this.request<unknown>(`/guest/manage/${token}`);
    return res.data;
  }

  /**
   * Update guest info by manage token
   */
  async updateGuestByToken(
    token: string,
    payload: { fullName?: string; phone?: string; notes?: string }
  ): Promise<unknown> {
    const res = await this.request<unknown>(`/guest/manage/${token}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return res.data;
  }

  /**
   * Cancel guest registration by manage token
   */
  async cancelGuestByToken(token: string, reason?: string): Promise<unknown> {
    const res = await this.request<unknown>(`/guest/manage/${token}`, {
      method: "DELETE",
      body: JSON.stringify({ reason }),
    });
    return res.data;
  }

  // ========== Guest Invitation Decline ==========

  /**
   * Get guest decline info by token
   * Returns full ApiResponse to preserve success/message for UI logic
   */
  async getGuestDeclineInfo(token: string): Promise<unknown> {
    // Return full ApiResponse so calling component can inspect success/message.
    // Previously we returned only res.data which omitted the success flag and caused
    // the GuestDecline page to treat a valid response as an invalid link.
    return this.request<unknown>(`/guest/decline/${token}`);
  }

  /**
   * Submit guest decline with optional reason
   * Returns full ApiResponse to preserve success/message for UI logic
   */
  async submitGuestDecline(token: string, reason?: string): Promise<unknown> {
    // Same rationale as getGuestDeclineInfo: preserve success/message for UI logic.
    return this.request<unknown>(`/guest/decline/${token}`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  }
}

// Export singleton instance
const guestsApiClient = new GuestsApiClient();

// Export service methods
export const guestsService = {
  // Organizer/Admin methods
  guestSignup: (
    eventId: string,
    payload: Parameters<typeof guestsApiClient.guestSignup>[1]
  ) => guestsApiClient.guestSignup(eventId, payload),
  getEventGuests: (eventId: string) => guestsApiClient.getEventGuests(eventId),
  resendGuestManageLinkForEvent: (
    eventId: string,
    guestRegistrationId: string
  ) =>
    guestsApiClient.resendGuestManageLinkForEvent(eventId, guestRegistrationId),
  resendGuestManageLink: (guestRegistrationId: string) =>
    guestsApiClient.resendGuestManageLink(guestRegistrationId),
  updateGuestRegistrationForEvent: (
    eventId: string,
    guestRegistrationId: string,
    payload: Parameters<
      typeof guestsApiClient.updateGuestRegistrationForEvent
    >[2]
  ) =>
    guestsApiClient.updateGuestRegistrationForEvent(
      eventId,
      guestRegistrationId,
      payload
    ),
  updateGuestRegistration: (
    guestRegistrationId: string,
    payload: Parameters<typeof guestsApiClient.updateGuestRegistration>[1]
  ) => guestsApiClient.updateGuestRegistration(guestRegistrationId, payload),
  cancelGuestRegistrationForEvent: (
    eventId: string,
    guestRegistrationId: string,
    reason?: string
  ) =>
    guestsApiClient.cancelGuestRegistrationForEvent(
      eventId,
      guestRegistrationId,
      reason
    ),
  cancelGuestRegistration: (guestRegistrationId: string, reason?: string) =>
    guestsApiClient.cancelGuestRegistration(guestRegistrationId, reason),
  moveGuestBetweenRoles: (
    eventId: string,
    guestRegistrationId: string,
    fromRoleId: string,
    toRoleId: string
  ) =>
    guestsApiClient.moveGuestBetweenRoles(
      eventId,
      guestRegistrationId,
      fromRoleId,
      toRoleId
    ),

  // Guest self-service methods
  getGuestByToken: (token: string) => guestsApiClient.getGuestByToken(token),
  updateGuestByToken: (
    token: string,
    payload: Parameters<typeof guestsApiClient.updateGuestByToken>[1]
  ) => guestsApiClient.updateGuestByToken(token, payload),
  cancelGuestByToken: (token: string, reason?: string) =>
    guestsApiClient.cancelGuestByToken(token, reason),

  // Guest invitation decline methods
  getGuestDeclineInfo: (token: string) =>
    guestsApiClient.getGuestDeclineInfo(token),
  submitGuestDecline: (token: string, reason?: string) =>
    guestsApiClient.submitGuestDecline(token, reason),
};
