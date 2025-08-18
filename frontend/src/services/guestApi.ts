import { apiClient } from "./api";

export interface GuestSignupPayload {
  fullName: string;
  gender?: "male" | "female";
  email: string;
  phone?: string;
  notes?: string;
  roleId: string;
}

export const GuestApi = {
  async signup(eventId: string, payload: GuestSignupPayload) {
    return apiClient.guestSignup(eventId, payload);
  },

  async getEventGuests(eventId: string) {
    return apiClient.getEventGuests(eventId);
  },
};

export default GuestApi;
