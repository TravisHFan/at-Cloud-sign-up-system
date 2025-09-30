import { describe, it, expect } from "vitest";
import { serializePublicEvent } from "../../src/utils/publicEventSerializer";
import type { IEvent } from "../../src/models/Event";

// Minimal mock implementing only required fields for serializer
function makeEvent(overrides: Partial<IEvent & { _id: any }> = {}): IEvent {
  return {
    _id: overrides._id || "evt1",
    title: overrides.title || "Sample Event",
    purpose: overrides.purpose,
    agenda:
      overrides.agenda ||
      "Welcome and Intro\nWorkshop Sessions\nQ&A and Closing Remarks",
    date: overrides.date || "2025-01-01",
    endDate: overrides.endDate || "2025-01-01",
    time: overrides.time || "10:00",
    endTime: overrides.endTime || "12:00",
    location: overrides.location || "Main Hall",
    flyerUrl: overrides.flyerUrl,
    roles: overrides.roles || [],
    publicSlug: overrides.publicSlug || "sample-event",
    publish: true,
    // ...fields not used by serializer can be added as any
  } as unknown as IEvent;
}

describe("serializePublicEvent agenda newline preservation", () => {
  it("preserves newline boundaries in agenda", async () => {
    const event = makeEvent();
    const payload = await serializePublicEvent(event);
    expect(payload.agenda).toBe(
      "Welcome and Intro\nWorkshop Sessions\nQ&A and Closing Remarks"
    );
  });

  it("trims spaces per line but keeps newlines", async () => {
    const event = makeEvent({
      agenda:
        " Welcome   and   Intro \n  Workshop   Sessions \n Q&A and   Closing  Remarks  ",
    });
    const payload = await serializePublicEvent(event);
    expect(payload.agenda).toBe(
      "Welcome and Intro\nWorkshop Sessions\nQ&A and Closing Remarks"
    );
  });
});
