/**
 * Test file to verify 3x role validation is working correctly
 * This will help test the new validation system we just implemented
 */
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRoleValidation } from "../../hooks/useRoleValidation";

describe("useRoleValidation Hook", () => {
  it("should not show warnings when roles are within 3x template limits", () => {
    const formRoles = [
      {
        id: "1",
        name: "Host",
        description: "Event host",
        maxParticipants: 3,
        currentSignups: [],
      },
      {
        id: "2",
        name: "Presenter",
        description: "Content presenter",
        maxParticipants: 3,
        currentSignups: [],
      },
    ];

    const templates = {
      Conference: [
        { name: "Host", description: "Event host", maxParticipants: 1 },
        {
          name: "Presenter",
          description: "Content presenter",
          maxParticipants: 1,
        },
      ],
    };

    const { result } = renderHook(() =>
      useRoleValidation(formRoles, templates, "Conference")
    );

    expect(result.current.hasWarnings).toBe(false);
    expect(Object.keys(result.current.warnings)).toHaveLength(0);
  });

  it("should show warnings when roles exceed 3x template limits", () => {
    const formRoles = [
      {
        id: "1",
        name: "Host",
        description: "Event host",
        maxParticipants: 4,
        currentSignups: [],
      }, // 4 > 3 (1*3)
      {
        id: "2",
        name: "Presenter",
        description: "Content presenter",
        maxParticipants: 3,
        currentSignups: [],
      }, // 3 <= 3 (1*3)
    ];

    const templates = {
      Conference: [
        { name: "Host", description: "Event host", maxParticipants: 1 },
        {
          name: "Presenter",
          description: "Content presenter",
          maxParticipants: 1,
        },
      ],
    };

    const { result } = renderHook(() =>
      useRoleValidation(formRoles, templates, "Conference")
    );

    expect(result.current.hasWarnings).toBe(true);
    expect(result.current.warnings["0"]).toContain(
      "Warning: 4 exceeds recommended limit of 3 participants for Host"
    );
    expect(result.current.warnings["1"]).toBeUndefined(); // No warning for Presenter
  });

  it("should handle different event types correctly", () => {
    const formRoles = [
      {
        id: "1",
        name: "Facilitator",
        description: "Group facilitator",
        maxParticipants: 10,
        currentSignups: [],
      },
    ];

    const templates = {
      Workshop: [
        {
          name: "Facilitator",
          description: "Group facilitator",
          maxParticipants: 2,
        },
      ],
    };

    const { result } = renderHook(() =>
      useRoleValidation(formRoles, templates, "Workshop")
    );

    expect(result.current.hasWarnings).toBe(true);
    expect(result.current.warnings["0"]).toContain(
      "Warning: 10 exceeds recommended limit of 6 participants for Facilitator"
    );
  });

  it("should handle empty or missing data gracefully", () => {
    const { result } = renderHook(() => useRoleValidation([], {}, undefined));

    expect(result.current.hasWarnings).toBe(false);
    expect(Object.keys(result.current.warnings)).toHaveLength(0);
  });
});
