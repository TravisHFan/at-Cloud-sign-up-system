import { apiClient } from "./api";

export interface GuestSignupPayload {
  fullName: string;
  gender: "male" | "female";
  email: string;
  phone?: string;
  notes?: string;
  roleId: string;
}

export const GuestApi = {
  async signup(eventId: string, payload: GuestSignupPayload) {
    // Backend now allows one guest registration per event (not global).
    // Propagate errors directly; per-event duplicate handling is managed by the form.
    return await apiClient.guestSignup(eventId, payload);
  },

  async getEventGuests(eventId: string) {
    return apiClient.getEventGuests(eventId);
  },

  async getByToken(token: string) {
    return apiClient.getGuestByToken(token);
  },
  async updateByToken(
    token: string,
    payload: { fullName?: string; phone?: string; notes?: string }
  ) {
    return apiClient.updateGuestByToken(token, payload);
  },
  async cancelByToken(token: string, reason?: string) {
    return apiClient.cancelGuestByToken(token, reason);
  },
  async resendManageLink(
    guestRegistrationId: string,
    options?: { eventId?: string }
  ) {
    if (options?.eventId) {
      return apiClient.resendGuestManageLinkForEvent(
        options.eventId,
        guestRegistrationId
      );
    }
    return apiClient.resendGuestManageLink(guestRegistrationId);
  },
  async adminUpdateGuest(
    guestRegistrationId: string,
    payload: { fullName?: string; phone?: string; notes?: string },
    options?: { eventId?: string }
  ) {
    if (options?.eventId) {
      return apiClient.updateGuestRegistrationForEvent(
        options.eventId,
        guestRegistrationId,
        payload
      );
    }
    return apiClient.updateGuestRegistration(guestRegistrationId, payload);
  },
  async adminCancelGuest(
    guestRegistrationId: string,
    reason?: string,
    options?: { eventId?: string }
  ) {
    if (options?.eventId) {
      return apiClient.cancelGuestRegistrationForEvent(
        options.eventId,
        guestRegistrationId,
        reason
      );
    }
    return apiClient.cancelGuestRegistration(guestRegistrationId, reason);
  },
};

export default GuestApi;
