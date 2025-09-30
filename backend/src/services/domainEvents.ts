import { EventEmitter } from "events";

/**
 * Lightweight domain event emitter to decouple side-effects (email, analytics, etc.)
 * from core transactional logic without adding external infra.
 */
class DomainEvents extends EventEmitter {}

export const domainEvents = new DomainEvents();

// Event name constants
export const EVENT_AUTO_UNPUBLISHED = "event.auto_unpublished" as const;

export interface EventAutoUnpublishedPayload {
  eventId: string;
  title: string;
  format?: string;
  missingFields: string[];
  reason: string; // e.g. MISSING_REQUIRED_FIELDS
  autoUnpublishedAt: string; // ISO timestamp
}
