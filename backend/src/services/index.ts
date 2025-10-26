/**
 * Services Index
 * Central export point for all services
 * Follows Single Responsibility and Dependency Injection principles
 */

// Infrastructure services
export { NotificationService } from "./notifications/NotificationService";
export { TrioNotificationService } from "./notifications/TrioNotificationService";
export { EventService } from "./eventService";
export { UserService } from "./userService";
export { SubscriptionService } from "./SubscriptionService";
export { LockService } from "./infrastructure/LockService";
export { EmailService } from "./infrastructure/EmailServiceFacade";
export { ICSBuilder, buildEventICS } from "./ICSBuilder";
export { SystemConfigService } from "./SystemConfigService";
export {
  CacheService,
  cacheService,
  CachePatterns,
  type CacheEntry,
  type CacheMetrics,
  type CacheOptions,
  type CacheQueryOptions,
} from "./infrastructure/CacheService";
export { RegistrationQueryService } from "./RegistrationQueryService";
export { ResponseBuilderService } from "./ResponseBuilderService";
export { EventSnapshotBuilder } from "./EventSnapshotBuilder";
export {
  lockService,
  InMemoryLockService,
  type ILockService,
} from "./LockService";
export { ImageCompressionService } from "./ImageCompressionService";
export { EventCascadeService } from "./EventCascadeService";
export {
  MessageCleanupService,
  type CleanupStats,
} from "./MessageCleanupService";
export { SchedulerService } from "./SchedulerService";

// Utility Services
export { ValidationService } from "./ValidationService";
export {
  Logger,
  LogLevel,
  createLogger,
  getLogLevelFromString,
} from "./LoggerService";
export {
  ErrorHandlingService,
  AppError,
  ErrorType,
  createValidationError,
  createAuthenticationError,
  createAuthorizationError,
  createNotFoundError,
  createConflictError,
  createDatabaseError,
  createRateLimitError,
  asyncHandler,
  handleValidationResult,
} from "./ErrorHandlingService";

// Note: Business logic services have been consolidated into user-centric controllers
// See: backend/src/controllers/userNotificationController.ts for notification services
// Repositories and Services will be available after TypeScript compilation issues are resolved
