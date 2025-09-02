import { describe, it, expect } from "vitest";
import {
  profileSchema,
  type ProfileFormData,
} from "../../schemas/profileSchema";

function baseValid(): ProfileFormData {
  return {
    username: "alice01",
    firstName: "Alice",
    lastName: "Lee",
    gender: "female",
    email: "alice@example.com",
    phone: "",
    isAtCloudLeader: "No",
    roleInAtCloud: "",
    homeAddress: "",
    occupation: "",
    company: "",
    weeklyChurch: "",
    churchAddress: "",
  };
}

describe("profileSchema", () => {
  it("accepts a valid baseline profile with No @Cloud Co-worker", async () => {
    const value = await profileSchema.validate(baseValid());
    expect(value.username).toBe("alice01");
  });

  it("requires username, firstName, lastName, gender, and email", async () => {
    const invalid = {
      ...baseValid(),
      username: "",
      firstName: "",
      lastName: "",
      gender: "",
      email: "not-an-email",
    } as any;
    await expect(profileSchema.validate(invalid)).rejects.toThrow();
  });

  it("requires roleInAtCloud when isAtCloudLeader is Yes", async () => {
    const data = {
      ...baseValid(),
      isAtCloudLeader: "Yes" as const,
      roleInAtCloud: "",
    };
    await expect(profileSchema.validate(data)).rejects.toThrow(
      /Role in @Cloud is required/
    );
  });

  it("passes when isAtCloudLeader is Yes and roleInAtCloud is provided", async () => {
    const data = {
      ...baseValid(),
      isAtCloudLeader: "Yes" as const,
      roleInAtCloud: "Event Director",
    };
    const value = await profileSchema.validate(data);
    expect(value.roleInAtCloud).toBe("Event Director");
  });
});
