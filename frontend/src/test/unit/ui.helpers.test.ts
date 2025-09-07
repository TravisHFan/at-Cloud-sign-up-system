import { describe, it, expect } from "vitest";
import {
  getRoleBadgeClassNames,
  getEngagementBadgeClassNames,
} from "../../constants/ui";

// Contract reference (from ROLE_COLOR_SCHEME in src/constants/ui.ts):
//   "Super Admin"     -> bg-purple-100 text-purple-800
//   "Administrator"   -> bg-red-100    text-red-800
//   "Leader"          -> bg-yellow-100 text-yellow-800
//   "Guest Expert"    -> bg-cyan-100   text-cyan-800
//   "Participant"     -> bg-green-100  text-green-800
//   "@Cloud Co-workers" -> bg-orange-100 text-orange-800
// Unknown -> bg-gray-100 text-gray-800

describe("getRoleBadgeClassNames", () => {
  it("returns expected classes for all known roles", () => {
    const cases: Record<string, string> = {
      "Super Admin": "bg-purple-100 text-purple-800",
      Administrator: "bg-red-100 text-red-800",
      Leader: "bg-yellow-100 text-yellow-800",
      "Guest Expert": "bg-cyan-100 text-cyan-800",
      Participant: "bg-green-100 text-green-800",
      "@Cloud Co-workers": "bg-orange-100 text-orange-800",
    };

    for (const [role, expected] of Object.entries(cases)) {
      expect(getRoleBadgeClassNames(role)).toBe(expected);
    }
  });

  it("falls back to gray for unknown roles", () => {
    expect(getRoleBadgeClassNames("Unknown Role")).toBe(
      "bg-gray-100 text-gray-800"
    );
    expect(getRoleBadgeClassNames("")).toBe("bg-gray-100 text-gray-800");
  });
});

// Engagement tiers (inclusive ranges):
//  - n <= 0            -> gray
//  - 1 <= n <= 2       -> blue
//  - 3 <= n <= 4       -> green
//  - 5 <= n <= 9       -> orange
//  - n >= 10           -> purple

describe("getEngagementBadgeClassNames", () => {
  it("handles undefined, NaN, negative and zero as gray", () => {
    expect(getEngagementBadgeClassNames(undefined)).toBe(
      "bg-gray-100 text-gray-800"
    );
    expect(getEngagementBadgeClassNames(Number.NaN)).toBe(
      "bg-gray-100 text-gray-800"
    );
    expect(getEngagementBadgeClassNames(-1)).toBe("bg-gray-100 text-gray-800");
    expect(getEngagementBadgeClassNames(0)).toBe("bg-gray-100 text-gray-800");
  });

  it("returns blue for low engagement (1-2)", () => {
    expect(getEngagementBadgeClassNames(1)).toBe("bg-blue-100 text-blue-800");
    expect(getEngagementBadgeClassNames(2)).toBe("bg-blue-100 text-blue-800");
  });

  it("returns green for medium engagement (3-4)", () => {
    expect(getEngagementBadgeClassNames(3)).toBe("bg-green-100 text-green-800");
    expect(getEngagementBadgeClassNames(4)).toBe("bg-green-100 text-green-800");
  });

  it("returns orange for high engagement (5-9)", () => {
    expect(getEngagementBadgeClassNames(5)).toBe(
      "bg-orange-100 text-orange-800"
    );
    expect(getEngagementBadgeClassNames(9)).toBe(
      "bg-orange-100 text-orange-800"
    );
  });

  it("returns purple for elite engagement (>= 10)", () => {
    expect(getEngagementBadgeClassNames(10)).toBe(
      "bg-purple-100 text-purple-800"
    );
    expect(getEngagementBadgeClassNames(17)).toBe(
      "bg-purple-100 text-purple-800"
    );
  });
});
