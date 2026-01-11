/**
 * Models Index Unit Tests
 *
 * Tests model exports from models/index.ts
 * The database connection functions are tested via integration tests.
 */

import { describe, it, expect } from "vitest";

describe("models/index exports", () => {
  describe("Model exports", () => {
    it("should export User model and IUser type", async () => {
      const { User } = await import("../../../src/models/index");
      expect(User).toBeDefined();
    });

    it("should export Event model and related types", async () => {
      const { Event } = await import("../../../src/models/index");
      expect(Event).toBeDefined();
    });

    it("should export Registration model and related types", async () => {
      const { Registration } = await import("../../../src/models/index");
      expect(Registration).toBeDefined();
    });

    it("should export GuestRegistration model", async () => {
      const { GuestRegistration } = await import("../../../src/models/index");
      expect(GuestRegistration).toBeDefined();
    });

    it("should export Program model", async () => {
      const { Program } = await import("../../../src/models/index");
      expect(Program).toBeDefined();
    });

    it("should export ShortLink model", async () => {
      const { ShortLink } = await import("../../../src/models/index");
      expect(ShortLink).toBeDefined();
    });

    it("should export Purchase model", async () => {
      const { Purchase } = await import("../../../src/models/index");
      expect(Purchase).toBeDefined();
    });

    it("should export PromoCode model", async () => {
      const { PromoCode } = await import("../../../src/models/index");
      expect(PromoCode).toBeDefined();
    });

    it("should export SystemConfig model and related types", async () => {
      const { SystemConfig } = await import("../../../src/models/index");
      expect(SystemConfig).toBeDefined();
    });

    it("should export AuditLog model", async () => {
      const { AuditLog } = await import("../../../src/models/index");
      expect(AuditLog).toBeDefined();
    });

    it("should export RolesTemplate model", async () => {
      const { RolesTemplate } = await import("../../../src/models/index");
      expect(RolesTemplate).toBeDefined();
    });

    it("should export Message model", async () => {
      const { Message } = await import("../../../src/models/index");
      expect(Message).toBeDefined();
    });
  });

  describe("Database utility exports", () => {
    it("should export connectDatabase function", async () => {
      const { connectDatabase } = await import("../../../src/models/index");
      expect(connectDatabase).toBeDefined();
      expect(typeof connectDatabase).toBe("function");
    });

    it("should export checkDatabaseHealth function", async () => {
      const { checkDatabaseHealth } = await import("../../../src/models/index");
      expect(checkDatabaseHealth).toBeDefined();
      expect(typeof checkDatabaseHealth).toBe("function");
    });

    it("should export getDatabaseStats function", async () => {
      const { getDatabaseStats } = await import("../../../src/models/index");
      expect(getDatabaseStats).toBeDefined();
      expect(typeof getDatabaseStats).toBe("function");
    });
  });
});
