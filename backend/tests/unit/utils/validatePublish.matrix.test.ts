import { describe, it, expect } from "vitest";
import { NECESSARY_PUBLISH_FIELDS_BY_FORMAT } from "../../../src/utils/validatePublish";

/**
 * Guardrail: snapshot-like structural test for publish necessary fields matrix.
 * If this fails unexpectedly, update this test intentionally along with docs:
 * docs/PUBLISH_VALIDATION_RULES.md
 */

describe("NECESSARY_PUBLISH_FIELDS_BY_FORMAT matrix", () => {
  it("matches expected structure", () => {
    const expected: Record<string, string[]> = {
      Online: ["zoomLink", "meetingId", "passcode"],
      "In-person": ["location"],
      "Hybrid Participation": ["location", "zoomLink", "meetingId", "passcode"],
    };
    // Keys must match exactly
    expect(Object.keys(NECESSARY_PUBLISH_FIELDS_BY_FORMAT).sort()).toEqual(
      Object.keys(expected).sort()
    );
    for (const [k, v] of Object.entries(expected)) {
      expect(NECESSARY_PUBLISH_FIELDS_BY_FORMAT[k]).toEqual(v);
    }
  });
});
