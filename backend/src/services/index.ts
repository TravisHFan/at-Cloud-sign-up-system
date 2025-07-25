/**
 * Services Index
 * Central export point for all services
 * Follows Single Responsibility and Dependency Injection principles
 */

// Infrastructure services
export { EmailService } from "./infrastructure/emailService";
export {
  lockService,
  InMemoryLockService,
  type ILockService,
} from "./LockService";
export { ThreadSafeEventService } from "./ThreadSafeEventService";
export { ImageCompressionService } from "./ImageCompressionService";

// Utility Services
export { ValidationService } from "./ValidationService";
export { ConfigService } from "./ConfigService";
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
