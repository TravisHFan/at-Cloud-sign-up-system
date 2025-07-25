// Simple test setup
import { vi } from "vitest";

// Mock database connections to prevent timeouts
vi.mock("mongoose", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: {
      connect: vi.fn().mockResolvedValue({}),
      connection: {
        close: vi.fn().mockResolvedValue({}),
      },
    },
  };
});
