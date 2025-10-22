import { describe, it, expect, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import PromoCode, { IPromoCode } from "../../../src/models/PromoCode";

/**
 * PromoCode Model - Unit Tests
 *
 * Tests the business logic of the PromoCode model in isolation.
 * Focuses on:
 * - Instance methods (markAsUsed, canBeUsedForProgram, deactivate, reactivate)
 * - Static methods (generateUniqueCode, findValidCodesForUser)
 * - General vs Personal code behavior
 * - Usage history tracking
 */

describe("PromoCode Model - Unit Tests", () => {
  // ============================================================================
  // INSTANCE METHOD: canBeUsedForProgram()
  // ============================================================================

  describe("canBeUsedForProgram()", () => {
    describe("General validation rules", () => {
      it("returns invalid if code is not active", () => {
        const code = new PromoCode({
          code: "TEST0001",
          type: "bundle_discount",
          discountAmount: 5000,
          ownerId: new mongoose.Types.ObjectId(),
          isActive: false,
          isUsed: false,
          createdBy: "system",
        });

        const result = code.canBeUsedForProgram(new mongoose.Types.ObjectId());

        expect(result.valid).toBe(false);
        expect(result.reason).toBe("Code is no longer active");
      });

      it("returns invalid if code is expired", () => {
        const code = new PromoCode({
          code: "TEST0002",
          type: "bundle_discount",
          discountAmount: 5000,
          ownerId: new mongoose.Types.ObjectId(),
          isActive: true,
          isUsed: false,
          expiresAt: new Date("2020-01-01"), // Past date
          createdBy: "system",
        });

        const result = code.canBeUsedForProgram(new mongoose.Types.ObjectId());

        expect(result.valid).toBe(false);
        expect(result.reason).toContain("expired");
      });

      it("returns valid if code is active and not expired", () => {
        const code = new PromoCode({
          code: "TEST0003",
          type: "bundle_discount",
          discountAmount: 5000,
          ownerId: new mongoose.Types.ObjectId(),
          isActive: true,
          isUsed: false,
          expiresAt: new Date("2030-12-31"), // Future date
          createdBy: "system",
        });

        const result = code.canBeUsedForProgram(new mongoose.Types.ObjectId());

        expect(result.valid).toBe(true);
        expect(result.reason).toBeUndefined();
      });
    });

    describe("Personal codes (isGeneral=false)", () => {
      it("returns invalid if personal code is already used", () => {
        const code = new PromoCode({
          code: "PERSONAL",
          type: "staff_access",
          discountPercent: 100,
          ownerId: new mongoose.Types.ObjectId(),
          isGeneral: false,
          isActive: true,
          isUsed: true, // Already used
          createdBy: "admin",
        });

        const result = code.canBeUsedForProgram(new mongoose.Types.ObjectId());

        expect(result.valid).toBe(false);
        expect(result.reason).toContain("already been used");
      });

      it("returns valid if personal code is not used", () => {
        const code = new PromoCode({
          code: "PERSONAL",
          type: "staff_access",
          discountPercent: 100,
          ownerId: new mongoose.Types.ObjectId(),
          isGeneral: false,
          isActive: true,
          isUsed: false,
          createdBy: "admin",
        });

        const result = code.canBeUsedForProgram(new mongoose.Types.ObjectId());

        expect(result.valid).toBe(true);
      });
    });

    describe("General codes (isGeneral=true)", () => {
      it("returns valid even if isUsed=true (general codes are reusable)", () => {
        const code = new PromoCode({
          code: "GENERAL1",
          type: "staff_access",
          discountPercent: 100,
          isGeneral: true,
          description: "General Staff Code",
          isActive: true,
          isUsed: true, // Used but still valid
          createdBy: "admin",
        });

        const result = code.canBeUsedForProgram(new mongoose.Types.ObjectId());

        expect(result.valid).toBe(true);
        expect(result.reason).toBeUndefined();
      });

      it("returns valid for general code with no restrictions", () => {
        const code = new PromoCode({
          code: "GENERAL2",
          type: "staff_access",
          discountPercent: 50,
          isGeneral: true,
          description: "General Code",
          isActive: true,
          isUsed: false,
          createdBy: "admin",
        });

        const result = code.canBeUsedForProgram(new mongoose.Types.ObjectId());

        expect(result.valid).toBe(true);
      });
    });

    describe("Bundle discount codes", () => {
      it("returns invalid if used for excluded program", () => {
        const excludedProgramId = new mongoose.Types.ObjectId();

        const code = new PromoCode({
          code: "BUNDLE01",
          type: "bundle_discount",
          discountAmount: 5000,
          ownerId: new mongoose.Types.ObjectId(),
          excludedProgramId,
          isActive: true,
          isUsed: false,
          createdBy: "system",
        });

        const result = code.canBeUsedForProgram(excludedProgramId);

        expect(result.valid).toBe(false);
        expect(result.reason).toBe(
          "Cannot use bundle code on the program that generated it"
        );
      });

      it("returns valid if used for non-excluded program", () => {
        const excludedProgramId = new mongoose.Types.ObjectId();
        const differentProgramId = new mongoose.Types.ObjectId();

        const code = new PromoCode({
          code: "BUNDLE02",
          type: "bundle_discount",
          discountAmount: 5000,
          ownerId: new mongoose.Types.ObjectId(),
          excludedProgramId,
          isActive: true,
          isUsed: false,
          createdBy: "system",
        });

        const result = code.canBeUsedForProgram(differentProgramId);

        expect(result.valid).toBe(true);
      });
    });

    describe("Staff access codes with program restrictions", () => {
      it("returns invalid if program not in allowedProgramIds", () => {
        const allowedProgram = new mongoose.Types.ObjectId();
        const notAllowedProgram = new mongoose.Types.ObjectId();

        const code = new PromoCode({
          code: "STAFF001",
          type: "staff_access",
          discountPercent: 100,
          ownerId: new mongoose.Types.ObjectId(),
          allowedProgramIds: [allowedProgram],
          isActive: true,
          isUsed: false,
          createdBy: "admin",
        });

        const result = code.canBeUsedForProgram(notAllowedProgram);

        expect(result.valid).toBe(false);
        expect(result.reason).toContain("not valid for this program");
      });

      it("returns valid if program is in allowedProgramIds", () => {
        const allowedProgram = new mongoose.Types.ObjectId();

        const code = new PromoCode({
          code: "STAFF002",
          type: "staff_access",
          discountPercent: 100,
          ownerId: new mongoose.Types.ObjectId(),
          allowedProgramIds: [allowedProgram],
          isActive: true,
          isUsed: false,
          createdBy: "admin",
        });

        const result = code.canBeUsedForProgram(allowedProgram);

        expect(result.valid).toBe(true);
      });

      it("returns valid if allowedProgramIds is empty (all programs allowed)", () => {
        const code = new PromoCode({
          code: "STAFF003",
          type: "staff_access",
          discountPercent: 100,
          ownerId: new mongoose.Types.ObjectId(),
          allowedProgramIds: undefined, // No restrictions
          isActive: true,
          isUsed: false,
          createdBy: "admin",
        });

        const result = code.canBeUsedForProgram(new mongoose.Types.ObjectId());

        expect(result.valid).toBe(true);
      });
    });
  });

  // ============================================================================
  // INSTANCE METHOD: markAsUsed()
  // ============================================================================

  describe("markAsUsed()", () => {
    describe("Personal codes (isGeneral=false)", () => {
      it("sets isUsed=true and records usage details", async () => {
        const code = new PromoCode({
          code: "PERSONAL",
          type: "staff_access",
          discountPercent: 100,
          ownerId: new mongoose.Types.ObjectId(),
          isGeneral: false,
          isActive: true,
          isUsed: false,
          createdBy: "admin",
        });

        // Mock save
        const saveSpy = vi.spyOn(code, "save").mockResolvedValue(code);

        const programId = new mongoose.Types.ObjectId();
        const userId = new mongoose.Types.ObjectId();

        await code.markAsUsed(
          programId,
          userId,
          "John Doe",
          "john@example.com",
          "Test Program"
        );

        expect(code.isUsed).toBe(true);
        expect(code.usedAt).toBeInstanceOf(Date);
        expect(code.usedForProgramId).toEqual(programId);
        expect(code.usageHistory).toHaveLength(0); // Personal codes don't track history
        expect(saveSpy).toHaveBeenCalled();
      });

      it("works without optional user details", async () => {
        const code = new PromoCode({
          code: "PERSONAL2",
          type: "bundle_discount",
          discountAmount: 5000,
          ownerId: new mongoose.Types.ObjectId(),
          isGeneral: false,
          isActive: true,
          isUsed: false,
          createdBy: "system",
        });

        const saveSpy = vi.spyOn(code, "save").mockResolvedValue(code);

        const programId = new mongoose.Types.ObjectId();

        await code.markAsUsed(programId);

        expect(code.isUsed).toBe(true);
        expect(code.usedAt).toBeInstanceOf(Date);
        expect(code.usedForProgramId).toEqual(programId);
        expect(saveSpy).toHaveBeenCalled();
      });
    });

    describe("General codes (isGeneral=true)", () => {
      it("does NOT set isUsed=true, appends to usageHistory instead", async () => {
        const code = new PromoCode({
          code: "GENERAL1",
          type: "staff_access",
          discountPercent: 100,
          isGeneral: true,
          description: "General Staff Code",
          isActive: true,
          isUsed: false,
          usageHistory: [],
          createdBy: "admin",
        });

        const saveSpy = vi.spyOn(code, "save").mockResolvedValue(code);

        const programId = new mongoose.Types.ObjectId();
        const userId = new mongoose.Types.ObjectId();

        await code.markAsUsed(
          programId,
          userId,
          "Jane Smith",
          "jane@example.com",
          "Program Title"
        );

        // General codes remain isUsed=false
        expect(code.isUsed).toBe(false);

        // Usage is tracked in history
        expect(code.usageHistory).toHaveLength(1);
        expect(code.usageHistory![0]).toMatchObject({
          userId,
          userName: "Jane Smith",
          userEmail: "jane@example.com",
          programId,
          programTitle: "Program Title",
        });
        expect(code.usageHistory![0].usedAt).toBeInstanceOf(Date);

        expect(saveSpy).toHaveBeenCalled();
      });

      it("appends multiple usages to history array", async () => {
        const code = new PromoCode({
          code: "GENERAL2",
          type: "staff_access",
          discountPercent: 100,
          isGeneral: true,
          description: "General Staff Code",
          isActive: true,
          isUsed: false,
          usageHistory: [],
          createdBy: "admin",
        });

        const saveSpy = vi.spyOn(code, "save").mockResolvedValue(code);

        const program1 = new mongoose.Types.ObjectId();
        const program2 = new mongoose.Types.ObjectId();
        const user1 = new mongoose.Types.ObjectId();
        const user2 = new mongoose.Types.ObjectId();

        // First usage
        await code.markAsUsed(
          program1,
          user1,
          "User One",
          "user1@example.com",
          "Program 1"
        );

        expect(code.usageHistory).toHaveLength(1);
        expect(code.isUsed).toBe(false);

        // Second usage
        await code.markAsUsed(
          program2,
          user2,
          "User Two",
          "user2@example.com",
          "Program 2"
        );

        expect(code.usageHistory).toHaveLength(2);
        expect(code.isUsed).toBe(false);

        // Verify both entries
        expect(code.usageHistory![0].userId).toEqual(user1);
        expect(code.usageHistory![1].userId).toEqual(user2);

        expect(saveSpy).toHaveBeenCalledTimes(2);
      });

      it("initializes usageHistory if undefined", async () => {
        const code = new PromoCode({
          code: "GENERAL3",
          type: "staff_access",
          discountPercent: 100,
          isGeneral: true,
          description: "General Staff Code",
          isActive: true,
          isUsed: false,
          // usageHistory not initialized
          createdBy: "admin",
        });

        const saveSpy = vi.spyOn(code, "save").mockResolvedValue(code);

        const programId = new mongoose.Types.ObjectId();
        const userId = new mongoose.Types.ObjectId();

        await code.markAsUsed(
          programId,
          userId,
          "Test User",
          "test@example.com",
          "Test Program"
        );

        expect(code.usageHistory).toBeDefined();
        expect(code.usageHistory).toHaveLength(1);
        expect(saveSpy).toHaveBeenCalled();
      });
    });

    describe("Edge cases", () => {
      it("throws error if user details are missing for general codes", async () => {
        const code = new PromoCode({
          code: "GENERAL4",
          type: "staff_access",
          discountPercent: 100,
          isGeneral: true,
          description: "General Staff Code",
          isActive: true,
          isUsed: false,
          usageHistory: [],
          createdBy: "admin",
        });

        const programId = new mongoose.Types.ObjectId();

        // Should throw error when user details are missing
        await expect(code.markAsUsed(programId)).rejects.toThrow(
          "User information (userId, userName, userEmail) is required for general code usage tracking"
        );
      });
    });
  });

  // ============================================================================
  // INSTANCE METHOD: deactivate()
  // ============================================================================

  describe("deactivate()", () => {
    it("sets isActive to false", async () => {
      const code = new PromoCode({
        code: "DEACT001",
        type: "staff_access",
        discountPercent: 100,
        ownerId: new mongoose.Types.ObjectId(),
        isActive: true,
        isUsed: false,
        createdBy: "admin",
      });

      const saveSpy = vi.spyOn(code, "save").mockResolvedValue(code);

      await code.deactivate();

      expect(code.isActive).toBe(false);
      expect(saveSpy).toHaveBeenCalled();
    });

    it("can deactivate already deactivated code (idempotent)", async () => {
      const code = new PromoCode({
        code: "DEACT002",
        type: "staff_access",
        discountPercent: 100,
        ownerId: new mongoose.Types.ObjectId(),
        isActive: false, // Already deactivated
        isUsed: false,
        createdBy: "admin",
      });

      const saveSpy = vi.spyOn(code, "save").mockResolvedValue(code);

      await code.deactivate();

      expect(code.isActive).toBe(false);
      expect(saveSpy).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // INSTANCE METHOD: reactivate()
  // ============================================================================

  describe("reactivate()", () => {
    it("sets isActive to true", async () => {
      const code = new PromoCode({
        code: "REACT001",
        type: "staff_access",
        discountPercent: 100,
        ownerId: new mongoose.Types.ObjectId(),
        isActive: false,
        isUsed: false,
        createdBy: "admin",
      });

      const saveSpy = vi.spyOn(code, "save").mockResolvedValue(code);

      await code.reactivate();

      expect(code.isActive).toBe(true);
      expect(saveSpy).toHaveBeenCalled();
    });

    it("can reactivate already active code (idempotent)", async () => {
      const code = new PromoCode({
        code: "REACT002",
        type: "staff_access",
        discountPercent: 100,
        ownerId: new mongoose.Types.ObjectId(),
        isActive: true, // Already active
        isUsed: false,
        createdBy: "admin",
      });

      const saveSpy = vi.spyOn(code, "save").mockResolvedValue(code);

      await code.reactivate();

      expect(code.isActive).toBe(true);
      expect(saveSpy).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // STATIC METHOD: generateUniqueCode()
  // ============================================================================

  describe("generateUniqueCode()", () => {
    it("generates 8-character uppercase alphanumeric code", async () => {
      // Mock findOne to always return null (unique code)
      const findOneSpy = vi.spyOn(PromoCode, "findOne").mockResolvedValue(null);

      const code = await PromoCode.generateUniqueCode();

      expect(code).toHaveLength(8);
      expect(code).toMatch(/^[A-Z0-9]{8}$/);
      expect(findOneSpy).toHaveBeenCalled();
    });

    it("generates different codes on multiple calls", async () => {
      const findOneSpy = vi.spyOn(PromoCode, "findOne").mockResolvedValue(null);

      const code1 = await PromoCode.generateUniqueCode();
      const code2 = await PromoCode.generateUniqueCode();
      const code3 = await PromoCode.generateUniqueCode();

      // All should be different (extremely high probability)
      expect(code1).not.toBe(code2);
      expect(code2).not.toBe(code3);
      expect(code1).not.toBe(code3);

      expect(findOneSpy).toHaveBeenCalledTimes(3);
    });

    it("retries if generated code already exists", async () => {
      // First two calls return existing code, third returns null
      const findOneSpy = vi
        .spyOn(PromoCode, "findOne")
        .mockResolvedValueOnce({ code: "EXISTS01" } as any)
        .mockResolvedValueOnce({ code: "EXISTS02" } as any)
        .mockResolvedValueOnce(null);

      const code = await PromoCode.generateUniqueCode();

      expect(code).toHaveLength(8);
      expect(code).toMatch(/^[A-Z0-9]{8}$/);
      expect(findOneSpy).toHaveBeenCalledTimes(3); // Retried 3 times
    });
  });

  // ============================================================================
  // STATIC METHOD: findValidCodesForUser()
  // ============================================================================

  describe("findValidCodesForUser()", () => {
    it("filters out inactive codes", async () => {
      const userId = new mongoose.Types.ObjectId();

      // Only return codes that match the query (isActive: true, isUsed: false)
      const mockCodes = [
        {
          code: "ACTIVE01",
          isActive: true,
          isUsed: false,
          canBeUsedForProgram: () => ({ valid: true }),
        },
      ];

      const findSpy = vi.spyOn(PromoCode, "find").mockReturnValue({
        sort: vi.fn().mockResolvedValue(mockCodes),
      } as any);

      const validCodes = await PromoCode.findValidCodesForUser(userId);

      expect(findSpy).toHaveBeenCalledWith({
        ownerId: userId,
        isActive: true,
        isUsed: false,
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: { $gte: expect.any(Date) } },
        ],
      });
      expect(validCodes).toHaveLength(1);
      expect(validCodes[0].code).toBe("ACTIVE01");
    });

    it("filters out expired codes", async () => {
      const userId = new mongoose.Types.ObjectId();

      // Only return codes that pass the expiry check in the query
      const mockCodes = [
        {
          code: "VALID001",
          isActive: true,
          isUsed: false,
          expiresAt: new Date("2030-12-31"),
          canBeUsedForProgram: () => ({ valid: true }),
        },
      ];

      vi.spyOn(PromoCode, "find").mockReturnValue({
        sort: vi.fn().mockResolvedValue(mockCodes),
      } as any);

      const validCodes = await PromoCode.findValidCodesForUser(userId);

      expect(validCodes).toHaveLength(1);
      expect(validCodes[0].code).toBe("VALID001");
    });

    it("filters by programId for staff_access codes", async () => {
      const userId = new mongoose.Types.ObjectId();
      const programId = new mongoose.Types.ObjectId();

      const mockCodes = [
        {
          code: "ALLOWED1",
          type: "staff_access",
          allowedProgramIds: [programId],
          isActive: true,
          isUsed: false,
          canBeUsedForProgram: (pid: any) => ({
            valid: pid.toString() === programId.toString(),
          }),
        },
        {
          code: "NOTALLOW",
          type: "staff_access",
          allowedProgramIds: [new mongoose.Types.ObjectId()],
          isActive: true,
          isUsed: false,
          canBeUsedForProgram: () => ({
            valid: false,
            reason: "not valid for this program",
          }),
        },
      ];

      vi.spyOn(PromoCode, "find").mockReturnValue({
        sort: vi.fn().mockResolvedValue(mockCodes),
      } as any);

      const validCodes = await PromoCode.findValidCodesForUser(
        userId,
        programId
      );

      expect(validCodes).toHaveLength(1);
      expect(validCodes[0].code).toBe("ALLOWED1");
    });

    it("includes general codes (no ownerId) when querying for user", async () => {
      const userId = new mongoose.Types.ObjectId();

      const mockCodes = [
        {
          code: "PERSONAL",
          ownerId: userId,
          isGeneral: false,
          isActive: true,
          isUsed: false,
          canBeUsedForProgram: () => ({ valid: true }),
        },
        {
          code: "GENERAL1",
          ownerId: undefined,
          isGeneral: true,
          isActive: true,
          isUsed: false,
          canBeUsedForProgram: () => ({ valid: true }),
        },
      ];

      vi.spyOn(PromoCode, "find").mockReturnValue({
        sort: vi.fn().mockResolvedValue(mockCodes),
      } as any);

      const validCodes = await PromoCode.findValidCodesForUser(userId);

      // Should include both personal and general codes
      expect(validCodes).toHaveLength(2);
    });

    it("returns empty array if no valid codes found", async () => {
      const userId = new mongoose.Types.ObjectId();

      // Mock returns empty array (no codes match the query criteria)
      const mockCodes: any[] = [];

      vi.spyOn(PromoCode, "find").mockReturnValue({
        sort: vi.fn().mockResolvedValue(mockCodes),
      } as any);

      const validCodes = await PromoCode.findValidCodesForUser(userId);

      expect(validCodes).toEqual([]);
    });
  });

  // ============================================================================
  // VIRTUAL PROPERTIES
  // ============================================================================

  describe("Virtual properties", () => {
    describe("isExpired", () => {
      it("returns true if expiresAt is in the past", () => {
        const code = new PromoCode({
          code: "EXPIRED3",
          type: "bundle_discount",
          discountAmount: 5000,
          ownerId: new mongoose.Types.ObjectId(),
          expiresAt: new Date("2020-01-01"),
          isActive: true,
          isUsed: false,
          createdBy: "system",
        });

        expect(code.isExpired).toBe(true);
      });

      it("returns false if expiresAt is in the future", () => {
        const code = new PromoCode({
          code: "NOTEXPIR",
          type: "bundle_discount",
          discountAmount: 5000,
          ownerId: new mongoose.Types.ObjectId(),
          expiresAt: new Date("2030-12-31"),
          isActive: true,
          isUsed: false,
          createdBy: "system",
        });

        expect(code.isExpired).toBe(false);
      });

      it("returns false if expiresAt is undefined (never expires)", () => {
        const code = new PromoCode({
          code: "NOEXPIRY",
          type: "bundle_discount",
          discountAmount: 5000,
          ownerId: new mongoose.Types.ObjectId(),
          expiresAt: undefined,
          isActive: true,
          isUsed: false,
          createdBy: "system",
        });

        expect(code.isExpired).toBe(false);
      });
    });

    describe("isValid", () => {
      it("returns false if code is inactive", () => {
        const code = new PromoCode({
          code: "INACTIVE",
          type: "bundle_discount",
          discountAmount: 5000,
          ownerId: new mongoose.Types.ObjectId(),
          isActive: false,
          isUsed: false,
          createdBy: "system",
        });

        expect(code.isValid).toBe(false);
      });

      it("returns false if code is expired", () => {
        const code = new PromoCode({
          code: "EXPIRED4",
          type: "bundle_discount",
          discountAmount: 5000,
          ownerId: new mongoose.Types.ObjectId(),
          isActive: true,
          isUsed: false,
          expiresAt: new Date("2020-01-01"),
          createdBy: "system",
        });

        expect(code.isValid).toBe(false);
      });

      it("returns false if personal code is used", () => {
        const code = new PromoCode({
          code: "USED0001",
          type: "bundle_discount",
          discountAmount: 5000,
          ownerId: new mongoose.Types.ObjectId(),
          isGeneral: false,
          isActive: true,
          isUsed: true,
          createdBy: "system",
        });

        expect(code.isValid).toBe(false);
      });

      it("returns true if general code has usage history (general codes track history, not isUsed)", () => {
        const code = new PromoCode({
          code: "GENERAL5",
          type: "staff_access",
          discountPercent: 100,
          isGeneral: true,
          description: "Reusable General Code",
          isActive: true,
          isUsed: false, // General codes should never have isUsed=true
          usageHistory: [
            {
              userId: new mongoose.Types.ObjectId(),
              userName: "User 1",
              userEmail: "user1@example.com",
              usedAt: new Date(),
              programId: new mongoose.Types.ObjectId(),
            },
          ],
          createdBy: "admin",
        });

        expect(code.isValid).toBe(true);
      });

      it("returns true if code is active, not expired, and not used", () => {
        const code = new PromoCode({
          code: "ALLVALID",
          type: "staff_access",
          discountPercent: 50,
          ownerId: new mongoose.Types.ObjectId(),
          isActive: true,
          isUsed: false,
          expiresAt: new Date("2030-12-31"),
          createdBy: "admin",
        });

        expect(code.isValid).toBe(true);
      });
    });
  });
});
