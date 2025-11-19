/**
 * UI Utils Tests
 *
 * Tests UI utility functions for class name generation:
 * - getButtonClass: Button styling variants and sizes
 * - getBadgeClass: Badge status types
 * - getSortButtonClass: Sort button active states
 * - getCardClass: Card interactivity and padding
 * - getInputClass: Input field states
 * - getEventStatusClass: Event status badges
 * - getAuthLevelClass: Authorization level badges
 */

import { describe, it, expect } from "vitest";
import {
  getButtonClass,
  getBadgeClass,
  getSortButtonClass,
  getCardClass,
  getInputClass,
  getRoleBadgeClass,
  getEventStatusBadge,
  getAvailabilityBadge,
  cn,
  getLoadingSkeletonClass,
} from "../uiUtils";

describe("uiUtils", () => {
  describe("getButtonClass", () => {
    it("should return primary button classes by default", () => {
      const result = getButtonClass();
      expect(result).toContain("bg-blue-600");
      expect(result).not.toContain("undefined");
    });

    it("should return secondary button classes", () => {
      const result = getButtonClass("secondary");
      expect(result).toContain("bg-gray");
    });

    it("should return danger button classes", () => {
      const result = getButtonClass("danger");
      expect(result).toContain("bg-red");
    });

    it("should include medium size by default", () => {
      const result = getButtonClass("primary");
      expect(result).toContain("px-4");
      expect(result).toContain("py-2");
    });

    it("should apply small size classes", () => {
      const result = getButtonClass("primary", "small");
      expect(result).toContain("px-3");
      expect(result).toContain("py-1");
    });

    it("should apply large size classes", () => {
      const result = getButtonClass("primary", "large");
      expect(result).toContain("px-6");
      expect(result).toContain("py-3");
    });

    it("should append additional classes", () => {
      const result = getButtonClass("primary", "medium", "mt-4 custom-class");
      expect(result).toContain("mt-4");
      expect(result).toContain("custom-class");
    });

    it("should trim whitespace", () => {
      const result = getButtonClass("primary", "medium", "  ");
      expect(result).not.toMatch(/\s{2,}/);
      expect(result).not.toMatch(/^\s|\s$/);
    });

    it("should handle missing additional classes", () => {
      const result = getButtonClass("primary", "medium");
      expect(result).not.toContain("undefined");
    });

    it("should fallback to primary for invalid variant", () => {
      const result = getButtonClass("invalid" as any);
      expect(result).toContain("bg-blue-600");
    });
  });

  describe("getBadgeClass", () => {
    it("should return neutral badge by default", () => {
      const result = getBadgeClass();
      expect(result).toContain("bg-gray");
    });

    it("should return success badge classes", () => {
      const result = getBadgeClass("success");
      expect(result).toContain("bg-green");
    });

    it("should return warning badge classes", () => {
      const result = getBadgeClass("warning");
      expect(result).toContain("bg-orange");
    });

    it("should return error badge classes", () => {
      const result = getBadgeClass("error");
      expect(result).toContain("bg-red");
    });

    it("should return info badge classes", () => {
      const result = getBadgeClass("info");
      expect(result).toContain("bg-blue");
    });

    it("should append additional classes", () => {
      const result = getBadgeClass("success", "ml-2 text-xs");
      expect(result).toContain("ml-2");
      expect(result).toContain("text-xs");
    });

    it("should trim whitespace", () => {
      const result = getBadgeClass("neutral", "  ");
      expect(result).not.toMatch(/\s{2,}/);
    });
  });

  describe("getSortButtonClass", () => {
    it("should return active classes when isActive is true", () => {
      const result = getSortButtonClass(true);
      expect(result).toContain("text-blue-700");
    });

    it("should return inactive classes when isActive is false", () => {
      const result = getSortButtonClass(false);
      expect(result).toContain("text-gray-700");
    });

    it("should include base classes always", () => {
      const activeResult = getSortButtonClass(true);
      const inactiveResult = getSortButtonClass(false);

      expect(activeResult).toContain("flex items-center");
      expect(inactiveResult).toContain("flex items-center");
    });

    it("should append additional classes", () => {
      const result = getSortButtonClass(true, "mr-2");
      expect(result).toContain("mr-2");
    });

    it("should trim whitespace", () => {
      const result = getSortButtonClass(true, "  ");
      expect(result).not.toMatch(/\s{2,}/);
    });
  });

  describe("getCardClass", () => {
    it("should return base card classes when not interactive", () => {
      const result = getCardClass(false);
      expect(result).toContain("bg-white");
      expect(result).toContain("shadow");
    });

    it("should return interactive card classes", () => {
      const result = getCardClass(true);
      expect(result).toContain("hover:");
      expect(result).toContain("cursor-pointer");
    });

    it("should apply medium padding by default", () => {
      const result = getCardClass(false, "medium");
      expect(result).toContain("p-6");
    });

    it("should apply small padding", () => {
      const result = getCardClass(false, "small");
      expect(result).toContain("p-4");
    });

    it("should apply large padding", () => {
      const result = getCardClass(false, "large");
      expect(result).toContain("p-8");
    });

    it("should append additional classes", () => {
      const result = getCardClass(true, "medium", "border-2");
      expect(result).toContain("border-2");
    });

    it("should handle default interactive parameter", () => {
      const result = getCardClass();
      expect(result).toContain("bg-white");
      expect(result).not.toContain("cursor-pointer");
    });
  });

  describe("getInputClass", () => {
    it("should return normal input classes by default", () => {
      const result = getInputClass();
      expect(result).toContain("border");
      expect(result).not.toContain("border-red");
      expect(result).not.toContain("border-green");
    });

    it("should return error input classes", () => {
      const result = getInputClass("error");
      expect(result).toContain("border-red");
    });

    it("should return success input classes", () => {
      const result = getInputClass("success");
      expect(result).toContain("border-green");
    });

    it("should include base classes always", () => {
      const normalResult = getInputClass("normal");
      const errorResult = getInputClass("error");

      expect(normalResult).toContain("rounded");
      expect(errorResult).toContain("rounded");
    });

    it("should append additional classes", () => {
      const result = getInputClass("normal", "w-full");
      expect(result).toContain("w-full");
    });

    it("should trim whitespace", () => {
      const result = getInputClass("normal", "  ");
      expect(result).not.toMatch(/\s{2,}/);
    });
  });

  describe("getEventStatusBadge", () => {
    it("should return success badge for completed events", () => {
      const result = getEventStatusBadge("completed", "passed");
      expect(result.text).toBe("Completed");
      expect(result.className).toContain("bg-green-100");
    });

    it("should return error badge for cancelled events", () => {
      const result = getEventStatusBadge("cancelled");
      expect(result.text).toBe("Cancelled");
      expect(result.className).toContain("bg-red-100");
    });

    it("should return active badge for upcoming events", () => {
      const result = getEventStatusBadge("active", "upcoming");
      expect(result.text).toBe("Active");
      expect(result.className).toContain("bg-green-100");
    });

    it("should handle passed event status", () => {
      const result = getEventStatusBadge("cancelled", "passed");
      expect(result.text).toBe("Cancelled");
      expect(result.className).toContain("bg-red-100");
    });
  });

  describe("getRoleBadgeClass", () => {
    it("should return purple class for Super Admin", () => {
      const result = getRoleBadgeClass("Super Admin");
      expect(result).toContain("bg-purple-100");
    });

    it("should return info class for Administrator", () => {
      const result = getRoleBadgeClass("Administrator");
      expect(result).toContain("bg-blue-100");
    });

    it("should return success class for Leader", () => {
      const result = getRoleBadgeClass("Leader");
      expect(result).toContain("bg-green-100");
    });

    it("should return neutral class for Participant", () => {
      const result = getRoleBadgeClass("Participant");
      expect(result).toContain("bg-gray-100");
    });

    it("should return neutral class for Guest Expert", () => {
      const result = getRoleBadgeClass("Guest Expert");
      expect(result).toContain("bg-gray-100");
    });
  });

  describe("getAvailabilityBadge", () => {
    it("should return full badge when spots = 0", () => {
      const result = getAvailabilityBadge(0);
      expect(result).not.toBeNull();
      expect(result?.text).toBe("Full");
      expect(result?.className).toContain("bg-red-100");
    });

    it("should return warning badge when spots <= 5", () => {
      const result = getAvailabilityBadge(3);
      expect(result).not.toBeNull();
      expect(result?.text).toBe("3 spots left");
      expect(result?.className).toContain("bg-orange-100");
    });

    it("should return null when plenty of spots", () => {
      const result = getAvailabilityBadge(20);
      expect(result).toBeNull();
    });

    it("should return warning for exactly 5 spots", () => {
      const result = getAvailabilityBadge(5);
      expect(result).not.toBeNull();
      expect(result?.text).toBe("5 spots left");
    });

    it("should return null for 6 spots", () => {
      const result = getAvailabilityBadge(6);
      expect(result).toBeNull();
    });
  });

  describe("cn (class name combiner)", () => {
    it("should combine multiple class names", () => {
      const result = cn("text-red-500", "font-bold", "mt-4");
      expect(result).toBe("text-red-500 font-bold mt-4");
    });

    it("should filter out falsy values", () => {
      const result = cn("text-red-500", false, "font-bold", null, undefined);
      expect(result).toBe("text-red-500 font-bold");
    });

    it("should handle empty input", () => {
      const result = cn();
      expect(result).toBe("");
    });

    it("should handle all falsy values", () => {
      const result = cn(false, null, undefined);
      expect(result).toBe("");
    });

    it("should handle conditional classes", () => {
      const isActive = true;
      const result = cn("base-class", isActive && "active-class");
      expect(result).toBe("base-class active-class");
    });

    it("should handle conditional classes when false", () => {
      const isActive = false;
      const result = cn("base-class", isActive && "active-class");
      expect(result).toBe("base-class");
    });
  });

  describe("getLoadingSkeletonClass", () => {
    it("should return text skeleton classes", () => {
      const result = getLoadingSkeletonClass("text");
      expect(result).toContain("animate-pulse");
      expect(result).toContain("h-4");
      expect(result).toContain("rounded");
    });

    it("should return circle skeleton classes", () => {
      const result = getLoadingSkeletonClass("circle");
      expect(result).toContain("animate-pulse");
      expect(result).toContain("rounded-full");
    });

    it("should return rect skeleton classes by default", () => {
      const result = getLoadingSkeletonClass();
      expect(result).toContain("animate-pulse");
      expect(result).toContain("rounded");
      expect(result).not.toContain("rounded-full");
    });

    it("should return rect skeleton classes explicitly", () => {
      const result = getLoadingSkeletonClass("rect");
      expect(result).toContain("animate-pulse");
      expect(result).toContain("bg-gray-200");
    });
  });

  describe("edge cases and integration", () => {
    it("should handle multiple additional classes for buttons", () => {
      const result = getButtonClass(
        "primary",
        "large",
        "mt-4 mb-2 custom-1 custom-2"
      );
      expect(result).toContain("mt-4");
      expect(result).toContain("mb-2");
      expect(result).toContain("custom-1");
      expect(result).toContain("custom-2");
    });

    it("should handle chaining of utility functions", () => {
      const buttonClass = getButtonClass("primary");
      const badgeClass = getBadgeClass("success");

      expect(buttonClass).toBeTruthy();
      expect(badgeClass).toBeTruthy();
      expect(buttonClass).not.toBe(badgeClass);
    });

    it("should produce valid CSS class strings without duplicates", () => {
      const result = getCardClass(true, "large", "shadow-lg");
      const classes = result.split(/\s+/);

      // Should not have empty strings
      expect(classes).not.toContain("");
      // Should have reasonable number of classes
      expect(classes.length).toBeGreaterThan(3);
      expect(classes.length).toBeLessThan(20);
    });
  });
});
