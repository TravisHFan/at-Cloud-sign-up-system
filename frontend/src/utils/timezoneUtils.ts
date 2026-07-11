// Centralized re-exports from shared timezone logic to prevent drift between frontend & backend.
// If adjustments are needed (e.g., different fallback strategies in the browser), wrap locally.
export {
  findUtcInstantFromLocal,
  formatViewerLocalTime,
  formatViewerLocalDateTime,
} from "@atcloud/shared-time";
export type { LocalDateTimeSpec } from "@atcloud/shared-time";
