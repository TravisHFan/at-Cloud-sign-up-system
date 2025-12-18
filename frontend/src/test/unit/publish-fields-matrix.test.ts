import { describe, it, expect } from "vitest";
import {
  NECESSARY_PUBLISH_FIELDS_BY_FORMAT,
  getMissingNecessaryFieldsForPublishFrontend,
  buildPublishReadinessMessage,
} from "../../types/event";
import type { EventRole } from "../../types/event";

// Helper to create a minimal valid public role for testing
const publicRole: EventRole = {
  id: "role-1",
  name: "Participant",
  description: "Test role",
  maxParticipants: 10,
  currentSignups: [],
  openToPublic: true,
};

describe("Publish necessary fields matrix (frontend mirror)", () => {
  it("has expected formats and field sets", () => {
    expect(NECESSARY_PUBLISH_FIELDS_BY_FORMAT.Online).toEqual([
      "zoomLink",
      "meetingId",
      "passcode",
    ]);
    expect(NECESSARY_PUBLISH_FIELDS_BY_FORMAT["In-person"]).toEqual([
      "location",
    ]);
    expect(
      NECESSARY_PUBLISH_FIELDS_BY_FORMAT["Hybrid Participation"].sort()
    ).toEqual(["location", "zoomLink", "meetingId", "passcode"].sort());
  });

  it("detects missing fields for Online", () => {
    const missing = getMissingNecessaryFieldsForPublishFrontend({
      format: "Online",
      zoomLink: " ",
      meetingId: "ABC",
      roles: [publicRole],
    });
    expect(missing.sort()).toEqual(["zoomLink", "passcode"].sort());
  });

  it("builds readiness message", () => {
    const msg = buildPublishReadinessMessage({
      format: "In-person",
      location: "",
      roles: [publicRole],
    });
    expect(msg).toContain("Location");
  });

  it("detects missing public role", () => {
    const missing = getMissingNecessaryFieldsForPublishFrontend({
      format: "In-person",
      location: "Test Location",
      roles: [], // No roles
    });
    expect(missing).toContain("roles");
  });
});
