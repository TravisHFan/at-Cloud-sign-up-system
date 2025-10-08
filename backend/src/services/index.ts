/**
 * Services Index
 * Central export point for all services
 * Follows Single Responsibility and Dependency Injection principles
 */

// Infrastructure services
export { EmailService } from "./infrastructure/emailService";
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
