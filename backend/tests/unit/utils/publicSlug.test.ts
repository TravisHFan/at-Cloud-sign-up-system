import { describe, it, expect, vi } from "vitest";
import { generateUniquePublicSlug } from "../../../src/utils/publicSlug";
import Event from "../../../src/models/Event";

vi.mock("../../../src/models/Event");

describe("generateUniquePublicSlug", () => {
  it("generates slug with random suffix and queries for collisions", async () => {
    const mockFindOne = vi.fn().mockResolvedValueOnce(null);
    (Event as any).findOne = () => ({ select: () => mockFindOne() });
    const slug = await generateUniquePublicSlug("My Great Event!!");
    expect(slug.startsWith("my-great-event-")).toBe(true);
    expect(slug.length).toBeLessThanOrEqual(60);
  });
  it("falls back after collisions", async () => {
    const mockFindOne = vi
      .fn()
      .mockResolvedValueOnce({ _id: "1" })
      .mockResolvedValueOnce({ _id: "2" })
      .mockResolvedValueOnce({ _id: "3" })
      .mockResolvedValueOnce({ _id: "4" })
      .mockResolvedValueOnce({ _id: "5" })
      .mockResolvedValue(null);
    (Event as any).findOne = () => ({ select: () => mockFindOne() });
    const slug = await generateUniquePublicSlug("Collision Event");
    expect(slug.startsWith("collision-event-")).toBe(true);
  });
});
