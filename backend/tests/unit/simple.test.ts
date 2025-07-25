import { describe, it, expect } from "vitest";

describe("Simple Unit Tests", () => {
  it("should pass basic assertion", () => {
    expect(1 + 1).toBe(2);
  });

  it("should handle string operations", () => {
    expect("hello".toUpperCase()).toBe("HELLO");
  });

  it("should work with arrays", () => {
    const arr = [1, 2, 3];
    expect(arr.length).toBe(3);
    expect(arr.includes(2)).toBe(true);
  });

  it("should handle objects", () => {
    const obj = { name: "test", value: 42 };
    expect(obj.name).toBe("test");
    expect(obj.value).toBe(42);
  });

  it("should work with async operations", async () => {
    const result = await Promise.resolve("async result");
    expect(result).toBe("async result");
  });
});
