/**
 * Complete ApiClient class that provides backward compatibility
 * by exposing all service methods as instance methods.
 *
 * This is a facade that delegates to the individual service instances.
 * Only includes methods that are actually used by pages/components.
 */

import { BaseApiClient } from "./common/baseApiClient";
import { authService } from "./auth.api";
import { feedbackService } from "./feedback.api";
import { publicEventsService } from "./publicEvents.api";
import { eventsService } from "./events.api";
import { programsService } from "./programs.api";
import { promoCodesService } from "./promoCodes.api";
import { usersService } from "./users.api";
import { guestsService } from "./guests.api";
import { filesService } from "./files.api";

/**
 * Full-featured ApiClient that exposes service methods directly used by pages
 * for backward compatibility with existing code.
 */
export class ApiClient extends BaseApiClient {
  // ============================================
  // Feedback Methods (used by Feedback.tsx)
  // ============================================
  submitFeedback = feedbackService.submitFeedback;

  // ============================================
  // Public Events Methods (used by PublicEvent.tsx, PublicEventsList.tsx)
  // ============================================
  getPublicEvents = publicEventsService.getPublicEvents;
  getPublicEvent = publicEventsService.getPublicEvent;
  registerForPublicEvent = publicEventsService.registerForPublicEvent;

  // ============================================
  // Events Methods (used by GuestConfirmation.tsx)
  // ============================================
  getEvent = eventsService.getEvent;

  // ============================================
  // Programs Methods (used by AdminPromoCodes.tsx)
  // ============================================
  listPrograms = programsService.listPrograms;

  // ============================================
  // Promo Codes Methods (used by AdminPromoCodes.tsx, PromoCodeDetail.tsx)
  // ============================================
  getAllPromoCodes = promoCodesService.getAllPromoCodes;
  deactivatePromoCode = promoCodesService.deactivatePromoCode;
  reactivatePromoCode = promoCodesService.reactivatePromoCode;
  createStaffPromoCode = promoCodesService.createStaffPromoCode;
  createGeneralStaffPromoCode = promoCodesService.createGeneralStaffPromoCode;
  getPromoCodeUsageHistory = promoCodesService.getPromoCodeUsageHistory;
  getBundleDiscountConfig = promoCodesService.getBundleDiscountConfig;
  updateBundleDiscountConfig = promoCodesService.updateBundleDiscountConfig;

  // ============================================
  // Users Methods (used by session-expired.prompt.test.ts, useUsersApi.ts)
  // ============================================
  getUserStats = usersService.getUserStats;
  getProfile = authService.getProfile;

  // ============================================
  // Guests Methods (used by guestApi.ts)
  // ============================================
  guestSignup = guestsService.guestSignup;
  getEventGuests = guestsService.getEventGuests;
  getGuestByToken = guestsService.getGuestByToken;
  updateGuestByToken = guestsService.updateGuestByToken;
  cancelGuestByToken = guestsService.cancelGuestByToken;
  resendGuestManageLinkForEvent = guestsService.resendGuestManageLinkForEvent;
  resendGuestManageLink = guestsService.resendGuestManageLink;
  updateGuestRegistrationForEvent =
    guestsService.updateGuestRegistrationForEvent;
  updateGuestRegistration = guestsService.updateGuestRegistration;
  cancelGuestRegistrationForEvent =
    guestsService.cancelGuestRegistrationForEvent;
  cancelGuestRegistration = guestsService.cancelGuestRegistration;
  getGuestDeclineInfo = guestsService.getGuestDeclineInfo;
  submitGuestDecline = guestsService.submitGuestDecline;

  // ============================================
  // Files Methods (used by Feedback.tsx, upload operations)
  // ============================================
  uploadGenericImage = filesService.uploadGenericImage;

  // ============================================
  // Programs Methods (used by ProgramParticipants.tsx)
  // ============================================
  adminEnroll = programsService.adminEnrollProgram;
  adminUnenroll = programsService.adminUnenrollProgram;

  // ============================================
  // Promo Codes Methods (used by promo code service)
  // ============================================
  validatePromoCode = promoCodesService.validatePromoCode;
  getMyPromoCodes = promoCodesService.getMyPromoCodes;
}

// Create and export a singleton instance
export const apiClient = new ApiClient();
