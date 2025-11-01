/**
 * Central export file for all API services
 *
 * This file re-exports all service modules and provides a single import point
 * for the frontend application. Also provides backward compatibility with legacy
 * imports using singular names (e.g., fileService instead of filesService).
 */

// Export common types and config
export * from "./common/types";
export { API_BASE_URL } from "./common/config";

// Export all service modules
export * from "./auth.api";
export * from "./feedback.api";
export * from "./guests.api";
export * from "./publicEvents.api";
export * from "./events.api";
export * from "./rolesTemplates.api";
export * from "./programs.api";
export * from "./purchases.api";
export * from "./promoCodes.api";
export * from "./users.api";
export * from "./files.api";
export * from "./notifications.api";
export * from "./systemMessages.api";
export * from "./messages.api";
export * from "./analytics.api";
export * from "./search.api";
export * from "./assignments.api";

// Import services for backward compatibility exports
import { authService } from "./auth.api";
import { guestsService } from "./guests.api";
import { publicEventsService } from "./publicEvents.api";
import { eventsService } from "./events.api";
import { rolesTemplatesService } from "./rolesTemplates.api";
import { programsService } from "./programs.api";
import { purchasesService } from "./purchases.api";
import { promoCodesService } from "./promoCodes.api";
import { usersService } from "./users.api";
import { filesService } from "./files.api";
import { notificationsService } from "./notifications.api";
import { systemMessagesService } from "./systemMessages.api";
import { messagesService } from "./messages.api";
import { analyticsService } from "./analytics.api";

// Backward compatibility: export services with legacy singular names
export { authService }; // Export authService directly since it has no singular alternative
export const fileService = filesService;
export const eventService = eventsService;
export const userService = usersService;
export const notificationService = notificationsService;
export const purchaseService = purchasesService;
export const programService = programsService;
export const promoCodeService = promoCodesService;
export const guestService = guestsService;
export const publicEventService = publicEventsService;
export const roleTemplateService = rolesTemplatesService;
export const systemMessageService = systemMessagesService;
export const messageService = messagesService;
export const analyticService = analyticsService;

// Export full ApiClient for backward compatibility with code that uses apiClient instance
export { apiClient, ApiClient } from "./apiClient";

// Default export for default imports
export { apiClient as default } from "./apiClient";
