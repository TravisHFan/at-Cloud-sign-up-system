// Centralized re-exports from shared timezone logic to prevent drift between frontend & backend.
// If adjustments are needed (e.g., different fallback strategies in the browser), wrap locally.
export {
  findUtcInstantFromLocal,
  formatViewerLocalTime,
  formatViewerLocalDateTime,
} from "../../../shared/time/timezoneSearch";
export type { LocalDateTimeSpec } from "../../../shared/time/timezoneSearch";
