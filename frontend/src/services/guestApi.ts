import { apiClient } from "./api";

export interface GuestSignupPayload {
  fullName: string;
  gender: "male" | "female";
  email: string;
  phone: string;
  notes?: string;
  roleId: string;
}

export const GuestApi = {
  async signup(eventId: string, payload: GuestSignupPayload) {
    try {
      return await apiClient.guestSignup(eventId, payload);
    } catch (err) {
      const raw = (err as any)?.message || String(err);
      // Map Single-Event Access backend errors to a friendly UI message
      // Backend messages typically contain phrases like:
      // - "A guest with this email already has an active registration for another event"
      // - "Guest already has an active registration for another event"
      if (/active registration/i.test(raw)) {
        throw new Error(
          "You already have an active guest registration. Cancel it first or use a different email."
        );
      }
      throw err;
    }
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
  async resendManageLink(guestRegistrationId: string) {
    return apiClient.resendGuestManageLink(guestRegistrationId);
  },
  async adminUpdateGuest(
    guestRegistrationId: string,
    payload: { fullName?: string; phone?: string; notes?: string }
  ) {
    return apiClient.updateGuestRegistration(guestRegistrationId, payload);
  },
  async adminCancelGuest(guestRegistrationId: string, reason?: string) {
    return apiClient.cancelGuestRegistration(guestRegistrationId, reason);
  },
};

export default GuestApi;
