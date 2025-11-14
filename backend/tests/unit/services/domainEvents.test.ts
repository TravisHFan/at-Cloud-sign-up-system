/**
 * Unit Tests for Domain Events
 *
 * Tests the lightweight event emitter for domain events
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  domainEvents,
  EVENT_AUTO_UNPUBLISHED,
  EventAutoUnpublishedPayload,
} from "../../../src/services/domainEvents";

describe("Domain Events", () => {
  beforeEach(() => {
    domainEvents.removeAllListeners();
  });

  it("should emit and receive event.auto_unpublished events", () => {
    const listener = vi.fn();
    domainEvents.on(EVENT_AUTO_UNPUBLISHED, listener);

    const payload: EventAutoUnpublishedPayload = {
      eventId: "event123",
      title: "Test Event",
      format: "In-Person",
      missingFields: ["location", "time"],
      reason: "MISSING_REQUIRED_FIELDS",
      autoUnpublishedAt: new Date().toISOString(),
    };

    domainEvents.emit(EVENT_AUTO_UNPUBLISHED, payload);

    expect(listener).toHaveBeenCalledWith(payload);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("should support multiple listeners for the same event", () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    domainEvents.on(EVENT_AUTO_UNPUBLISHED, listener1);
    domainEvents.on(EVENT_AUTO_UNPUBLISHED, listener2);

    const payload: EventAutoUnpublishedPayload = {
      eventId: "event456",
      title: "Multi Listener Event",
      missingFields: ["date"],
      reason: "MISSING_REQUIRED_FIELDS",
      autoUnpublishedAt: new Date().toISOString(),
    };

    domainEvents.emit(EVENT_AUTO_UNPUBLISHED, payload);

    expect(listener1).toHaveBeenCalledWith(payload);
    expect(listener2).toHaveBeenCalledWith(payload);
  });

  it("should allow removing listeners", () => {
    const listener = vi.fn();
    domainEvents.on(EVENT_AUTO_UNPUBLISHED, listener);
    domainEvents.off(EVENT_AUTO_UNPUBLISHED, listener);

    const payload: EventAutoUnpublishedPayload = {
      eventId: "event789",
      title: "Removed Listener Event",
      missingFields: ["location"],
      reason: "MISSING_REQUIRED_FIELDS",
      autoUnpublishedAt: new Date().toISOString(),
    };

    domainEvents.emit(EVENT_AUTO_UNPUBLISHED, payload);

    expect(listener).not.toHaveBeenCalled();
  });

  it("should handle events with optional format field", () => {
    const listener = vi.fn();
    domainEvents.on(EVENT_AUTO_UNPUBLISHED, listener);

    const payload: EventAutoUnpublishedPayload = {
      eventId: "event999",
      title: "No Format Event",
      missingFields: ["time"],
      reason: "MISSING_REQUIRED_FIELDS",
      autoUnpublishedAt: new Date().toISOString(),
    };

    domainEvents.emit(EVENT_AUTO_UNPUBLISHED, payload);

    expect(listener).toHaveBeenCalledWith(payload);
    expect(payload.format).toBeUndefined();
  });

  it("should support once listeners that fire only once", () => {
    const listener = vi.fn();
    domainEvents.once(EVENT_AUTO_UNPUBLISHED, listener);

    const payload1: EventAutoUnpublishedPayload = {
      eventId: "event1",
      title: "First Event",
      missingFields: ["location"],
      reason: "MISSING_REQUIRED_FIELDS",
      autoUnpublishedAt: new Date().toISOString(),
    };

    const payload2: EventAutoUnpublishedPayload = {
      eventId: "event2",
      title: "Second Event",
      missingFields: ["time"],
      reason: "MISSING_REQUIRED_FIELDS",
      autoUnpublishedAt: new Date().toISOString(),
    };

    domainEvents.emit(EVENT_AUTO_UNPUBLISHED, payload1);
    domainEvents.emit(EVENT_AUTO_UNPUBLISHED, payload2);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(payload1);
  });
});
