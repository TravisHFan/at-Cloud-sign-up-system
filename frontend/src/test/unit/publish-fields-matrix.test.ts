import { describe, it, expect } from "vitest";
import {
  NECESSARY_PUBLISH_FIELDS_BY_FORMAT,
  getMissingNecessaryFieldsForPublishFrontend,
  buildPublishReadinessMessage,
} from "../../types/event";

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
    });
    expect(missing.sort()).toEqual(["zoomLink", "passcode"].sort());
  });

  it("builds readiness message", () => {
    const msg = buildPublishReadinessMessage({
      format: "In-person",
      location: "",
    });
    expect(msg).toContain("Location");
  });
});
