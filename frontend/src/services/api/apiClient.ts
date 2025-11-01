/**
 * Complete ApiClient class that provides backward compatibility
 * by exposing all service methods as instance methods.
 *
 * This is a facade that delegates to the individual service instances.
 * Only includes methods that are actually used by pages/components.
 */

import { BaseApiClient } from "./common/baseApiClient";
import { feedbackService } from "./feedback.api";
import { publicEventsService } from "./publicEvents.api";
import { eventsService } from "./events.api";
import { programsService } from "./programs.api";
import { promoCodesService } from "./promoCodes.api";
import { usersService } from "./users.api";

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
  // Users Methods (used by session-expired.prompt.test.ts)
  // ============================================
  getUserStats = usersService.getUserStats;
}

// Create and export a singleton instance
export const apiClient = new ApiClient();
