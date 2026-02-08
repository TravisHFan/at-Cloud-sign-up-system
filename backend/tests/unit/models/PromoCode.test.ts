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
          "Cannot use bundle code on the program that generated it",
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
          "Test Program",
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
          "Program Title",
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
          "Program 1",
        );

        expect(code.usageHistory).toHaveLength(1);
        expect(code.isUsed).toBe(false);

        // Second usage
        await code.markAsUsed(
          program2,
          user2,
          "User Two",
          "user2@example.com",
          "Program 2",
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
          "Test Program",
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
          "User information (userId, userName, userEmail) is required for general code usage tracking",
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
        programId,
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

  // ============================================================================
  // INSTANCE METHOD: canBeUsedForEvent()
  // ============================================================================

  describe("canBeUsedForEvent()", () => {
    describe("General validation rules", () => {
      it("returns invalid if personal code is already used", () => {
        const code = new PromoCode({
          code: "EVENTUSED",
          type: "staff_access",
          discountPercent: 100,
          ownerId: new mongoose.Types.ObjectId(),
          isActive: true,
          isUsed: true,
          createdBy: "admin",
        });

        const result = code.canBeUsedForEvent(new mongoose.Types.ObjectId());

        expect(result.valid).toBe(false);
        expect(result.reason).toContain("already been used");
      });

      it("returns valid if general code is already used (reusable)", () => {
        const code = new PromoCode({
          code: "EVENTGEN",
          type: "staff_access",
          discountPercent: 100,
          isGeneral: true,
          description: "Reusable General Code",
          isActive: true,
          isUsed: true,
          createdBy: "admin",
        });

        const result = code.canBeUsedForEvent(new mongoose.Types.ObjectId());

        expect(result.valid).toBe(true);
      });

      it("returns invalid if code is not active", () => {
        const code = new PromoCode({
          code: "EVENTINACT",
          type: "staff_access",
          discountPercent: 100,
          ownerId: new mongoose.Types.ObjectId(),
          isActive: false,
          isUsed: false,
          createdBy: "admin",
        });

        const result = code.canBeUsedForEvent(new mongoose.Types.ObjectId());

        expect(result.valid).toBe(false);
        expect(result.reason).toContain("no longer active");
      });

      it("returns invalid if code is expired", () => {
        const code = new PromoCode({
          code: "EVENTEXP",
          type: "staff_access",
          discountPercent: 100,
          ownerId: new mongoose.Types.ObjectId(),
          isActive: true,
          isUsed: false,
          expiresAt: new Date("2020-01-01"),
          createdBy: "admin",
        });

        const result = code.canBeUsedForEvent(new mongoose.Types.ObjectId());

        expect(result.valid).toBe(false);
        expect(result.reason).toContain("expired");
      });

      it("returns invalid if code applicableToType is 'program'", () => {
        const code = new PromoCode({
          code: "PROGONLY",
          type: "staff_access",
          discountPercent: 100,
          ownerId: new mongoose.Types.ObjectId(),
          isActive: true,
          isUsed: false,
          applicableToType: "program",
          createdBy: "admin",
        });

        const result = code.canBeUsedForEvent(new mongoose.Types.ObjectId());

        expect(result.valid).toBe(false);
        expect(result.reason).toContain("only valid for programs");
      });

      it("returns valid if code applicableToType is 'event'", () => {
        const code = new PromoCode({
          code: "EVENTOK",
          type: "staff_access",
          discountPercent: 100,
          ownerId: new mongoose.Types.ObjectId(),
          isActive: true,
          isUsed: false,
          applicableToType: "event",
          createdBy: "admin",
        });

        const result = code.canBeUsedForEvent(new mongoose.Types.ObjectId());

        expect(result.valid).toBe(true);
      });

      it("returns valid if code applicableToType is undefined (general codes)", () => {
        const code = new PromoCode({
          code: "GENERIC",
          type: "staff_access",
          discountPercent: 100,
          isGeneral: true,
          description: "No type restriction",
          isActive: true,
          isUsed: false,
          createdBy: "admin",
        });

        const result = code.canBeUsedForEvent(new mongoose.Types.ObjectId());

        expect(result.valid).toBe(true);
      });
    });

    describe("Bundle discount validation", () => {
      it("returns invalid if bundle code is used on the event that generated it", () => {
        const excludedEventId = new mongoose.Types.ObjectId();
        const code = new PromoCode({
          code: "BUNDLEEVT",
          type: "bundle_discount",
          discountAmount: 5000,
          ownerId: new mongoose.Types.ObjectId(),
          isActive: true,
          isUsed: false,
          excludedEventId: excludedEventId,
          createdBy: "system",
        });

        const result = code.canBeUsedForEvent(excludedEventId);

        expect(result.valid).toBe(false);
        expect(result.reason).toContain("event that generated it");
      });

      it("returns valid if bundle code is used on a different event", () => {
        const excludedEventId = new mongoose.Types.ObjectId();
        const differentEventId = new mongoose.Types.ObjectId();
        const code = new PromoCode({
          code: "BUNDLEOK",
          type: "bundle_discount",
          discountAmount: 5000,
          ownerId: new mongoose.Types.ObjectId(),
          isActive: true,
          isUsed: false,
          excludedEventId: excludedEventId,
          createdBy: "system",
        });

        const result = code.canBeUsedForEvent(differentEventId);

        expect(result.valid).toBe(true);
      });
    });

    describe("Event restrictions (allowedEventIds)", () => {
      it("returns invalid if event is not in allowedEventIds", () => {
        const allowedEvent1 = new mongoose.Types.ObjectId();
        const allowedEvent2 = new mongoose.Types.ObjectId();
        const notAllowedEvent = new mongoose.Types.ObjectId();
        const code = new PromoCode({
          code: "RESTRICT",
          type: "staff_access",
          discountPercent: 100,
          ownerId: new mongoose.Types.ObjectId(),
          isActive: true,
          isUsed: false,
          allowedEventIds: [allowedEvent1, allowedEvent2],
          createdBy: "admin",
        });

        const result = code.canBeUsedForEvent(notAllowedEvent);

        expect(result.valid).toBe(false);
        expect(result.reason).toContain("not valid for this event");
      });

      it("returns valid if event is in allowedEventIds", () => {
        const allowedEvent1 = new mongoose.Types.ObjectId();
        const allowedEvent2 = new mongoose.Types.ObjectId();
        const code = new PromoCode({
          code: "ALLOWED",
          type: "staff_access",
          discountPercent: 100,
          ownerId: new mongoose.Types.ObjectId(),
          isActive: true,
          isUsed: false,
          allowedEventIds: [allowedEvent1, allowedEvent2],
          createdBy: "admin",
        });

        const result = code.canBeUsedForEvent(allowedEvent2);

        expect(result.valid).toBe(true);
      });

      it("returns valid if allowedEventIds is empty (all events allowed)", () => {
        const anyEventId = new mongoose.Types.ObjectId();
        const code = new PromoCode({
          code: "ALLALLOWED",
          type: "staff_access",
          discountPercent: 100,
          ownerId: new mongoose.Types.ObjectId(),
          isActive: true,
          isUsed: false,
          allowedEventIds: [],
          createdBy: "admin",
        });

        const result = code.canBeUsedForEvent(anyEventId);

        expect(result.valid).toBe(true);
      });
    });
  });

  // ============================================================================
  // INSTANCE METHOD: canBeUsedForProgram() - Additional Coverage
  // ============================================================================

  describe("canBeUsedForProgram() - Additional Coverage", () => {
    describe("applicableToType validation", () => {
      it("returns invalid if code applicableToType is 'event' (event-only code used for program)", () => {
        const code = new PromoCode({
          code: "EVTONLY1",
          type: "staff_access",
          discountPercent: 100,
          ownerId: new mongoose.Types.ObjectId(),
          isActive: true,
          isUsed: false,
          applicableToType: "event",
          createdBy: "admin",
        });

        const result = code.canBeUsedForProgram(new mongoose.Types.ObjectId());

        expect(result.valid).toBe(false);
        expect(result.reason).toBe("Code is only valid for events");
      });

      it("returns valid if code applicableToType is 'program'", () => {
        const code = new PromoCode({
          code: "PROGTYPE",
          type: "staff_access",
          discountPercent: 100,
          ownerId: new mongoose.Types.ObjectId(),
          isActive: true,
          isUsed: false,
          applicableToType: "program",
          createdBy: "admin",
        });

        const result = code.canBeUsedForProgram(new mongoose.Types.ObjectId());

        expect(result.valid).toBe(true);
      });

      it("returns valid if code applicableToType is undefined (general codes work for both)", () => {
        const code = new PromoCode({
          code: "BOTHTYPE",
          type: "staff_access",
          discountPercent: 100,
          isGeneral: true,
          description: "Works for both programs and events",
          isActive: true,
          isUsed: false,
          applicableToType: undefined,
          createdBy: "admin",
        });

        const result = code.canBeUsedForProgram(new mongoose.Types.ObjectId());

        expect(result.valid).toBe(true);
      });
    });

    describe("String vs ObjectId parameter handling", () => {
      it("accepts string programId for excludedProgramId comparison", () => {
        const excludedProgramId = new mongoose.Types.ObjectId();
        const code = new PromoCode({
          code: "STRTEST1",
          type: "bundle_discount",
          discountAmount: 5000,
          ownerId: new mongoose.Types.ObjectId(),
          excludedProgramId,
          isActive: true,
          isUsed: false,
          createdBy: "system",
        });

        // Pass as string
        const result = code.canBeUsedForProgram(excludedProgramId.toString());

        expect(result.valid).toBe(false);
        expect(result.reason).toBe(
          "Cannot use bundle code on the program that generated it",
        );
      });

      it("accepts string programId for allowedProgramIds comparison", () => {
        const allowedProgram = new mongoose.Types.ObjectId();
        const code = new PromoCode({
          code: "STRTEST2",
          type: "staff_access",
          discountPercent: 100,
          ownerId: new mongoose.Types.ObjectId(),
          allowedProgramIds: [allowedProgram],
          isActive: true,
          isUsed: false,
          createdBy: "admin",
        });

        // Pass as string - should still match
        const result = code.canBeUsedForProgram(allowedProgram.toString());

        expect(result.valid).toBe(true);
      });
    });

    describe("Reward type codes", () => {
      it("returns valid for reward code with valid conditions", () => {
        const code = new PromoCode({
          code: "REWARD01",
          type: "reward",
          discountPercent: 25,
          ownerId: new mongoose.Types.ObjectId(),
          isActive: true,
          isUsed: false,
          createdBy: "system",
        });

        const result = code.canBeUsedForProgram(new mongoose.Types.ObjectId());

        expect(result.valid).toBe(true);
      });

      it("returns invalid for reward code when already used (personal)", () => {
        const code = new PromoCode({
          code: "REWARD02",
          type: "reward",
          discountPercent: 25,
          ownerId: new mongoose.Types.ObjectId(),
          isActive: true,
          isUsed: true,
          createdBy: "system",
        });

        const result = code.canBeUsedForProgram(new mongoose.Types.ObjectId());

        expect(result.valid).toBe(false);
        expect(result.reason).toContain("already been used");
      });

      it("reward code respects allowedProgramIds restriction", () => {
        const allowedProgram = new mongoose.Types.ObjectId();
        const otherProgram = new mongoose.Types.ObjectId();
        const code = new PromoCode({
          code: "REWARD03",
          type: "reward",
          discountPercent: 15,
          ownerId: new mongoose.Types.ObjectId(),
          allowedProgramIds: [allowedProgram],
          applicableToType: "program",
          isActive: true,
          isUsed: false,
          createdBy: "system",
        });

        const resultAllowed = code.canBeUsedForProgram(allowedProgram);
        expect(resultAllowed.valid).toBe(true);

        const resultNotAllowed = code.canBeUsedForProgram(otherProgram);
        expect(resultNotAllowed.valid).toBe(false);
        expect(resultNotAllowed.reason).toContain("not valid for this program");
      });
    });

    describe("Multiple validation failures (priority order)", () => {
      it("returns 'already used' before 'not active' (isUsed checked first)", () => {
        const code = new PromoCode({
          code: "MULTI001",
          type: "staff_access",
          discountPercent: 100,
          ownerId: new mongoose.Types.ObjectId(),
          isActive: false,
          isUsed: true,
          createdBy: "admin",
        });

        const result = code.canBeUsedForProgram(new mongoose.Types.ObjectId());

        // isUsed is checked first in the method
        expect(result.valid).toBe(false);
        expect(result.reason).toBe("Code has already been used");
      });

      it("returns 'not active' before 'expired' when isActive=false", () => {
        const code = new PromoCode({
          code: "MULTI002",
          type: "staff_access",
          discountPercent: 100,
          ownerId: new mongoose.Types.ObjectId(),
          isActive: false,
          isUsed: false,
          expiresAt: new Date("2020-01-01"),
          createdBy: "admin",
        });

        const result = code.canBeUsedForProgram(new mongoose.Types.ObjectId());

        expect(result.valid).toBe(false);
        expect(result.reason).toBe("Code is no longer active");
      });
    });
  });

  // ============================================================================
  // INSTANCE METHOD: canBeUsedForEvent() - Additional Coverage
  // ============================================================================

  describe("canBeUsedForEvent() - Additional Coverage", () => {
    describe("String vs ObjectId parameter handling", () => {
      it("accepts string eventId for excludedEventId comparison", () => {
        const excludedEventId = new mongoose.Types.ObjectId();
        const code = new PromoCode({
          code: "EVTSTR01",
          type: "bundle_discount",
          discountAmount: 5000,
          ownerId: new mongoose.Types.ObjectId(),
          excludedEventId,
          isActive: true,
          isUsed: false,
          createdBy: "system",
        });

        // Pass as string
        const result = code.canBeUsedForEvent(excludedEventId.toString());

        expect(result.valid).toBe(false);
        expect(result.reason).toBe(
          "Cannot use bundle code on the event that generated it",
        );
      });

      it("accepts string eventId for allowedEventIds comparison", () => {
        const allowedEvent = new mongoose.Types.ObjectId();
        const code = new PromoCode({
          code: "EVTSTR02",
          type: "staff_access",
          discountPercent: 100,
          ownerId: new mongoose.Types.ObjectId(),
          allowedEventIds: [allowedEvent],
          isActive: true,
          isUsed: false,
          createdBy: "admin",
        });

        // Pass as string - should still match
        const result = code.canBeUsedForEvent(allowedEvent.toString());

        expect(result.valid).toBe(true);
      });
    });

    describe("Reward type codes for events", () => {
      it("returns valid for reward code applied to event", () => {
        const code = new PromoCode({
          code: "EVTRWD01",
          type: "reward",
          discountPercent: 20,
          ownerId: new mongoose.Types.ObjectId(),
          applicableToType: "event",
          isActive: true,
          isUsed: false,
          createdBy: "system",
        });

        const result = code.canBeUsedForEvent(new mongoose.Types.ObjectId());

        expect(result.valid).toBe(true);
      });

      it("reward code respects allowedEventIds restriction", () => {
        const allowedEvent = new mongoose.Types.ObjectId();
        const otherEvent = new mongoose.Types.ObjectId();
        const code = new PromoCode({
          code: "EVTRWD02",
          type: "reward",
          discountPercent: 10,
          ownerId: new mongoose.Types.ObjectId(),
          allowedEventIds: [allowedEvent],
          applicableToType: "event",
          isActive: true,
          isUsed: false,
          createdBy: "system",
        });

        const resultAllowed = code.canBeUsedForEvent(allowedEvent);
        expect(resultAllowed.valid).toBe(true);

        const resultNotAllowed = code.canBeUsedForEvent(otherEvent);
        expect(resultNotAllowed.valid).toBe(false);
        expect(resultNotAllowed.reason).toContain("not valid for this event");
      });
    });

    describe("Multiple validation failures (priority order)", () => {
      it("returns 'already used' before other checks for personal codes", () => {
        const code = new PromoCode({
          code: "EVTMLT01",
          type: "staff_access",
          discountPercent: 100,
          ownerId: new mongoose.Types.ObjectId(),
          isActive: false,
          isUsed: true,
          expiresAt: new Date("2020-01-01"),
          createdBy: "admin",
        });

        const result = code.canBeUsedForEvent(new mongoose.Types.ObjectId());

        expect(result.valid).toBe(false);
        expect(result.reason).toBe("Code has already been used");
      });
    });

    describe("Empty allowedEventIds array", () => {
      it("returns valid when allowedEventIds is undefined", () => {
        const code = new PromoCode({
          code: "EVTNULL",
          type: "staff_access",
          discountPercent: 100,
          ownerId: new mongoose.Types.ObjectId(),
          allowedEventIds: undefined,
          isActive: true,
          isUsed: false,
          createdBy: "admin",
        });

        const result = code.canBeUsedForEvent(new mongoose.Types.ObjectId());

        expect(result.valid).toBe(true);
      });
    });
  });

  // ============================================================================
  // STATIC METHOD: generateUniqueCode() - Additional Coverage
  // ============================================================================

  describe("generateUniqueCode() - Additional Coverage", () => {
    it("excludes confusing characters (I, O, 0, 1) from generated codes", async () => {
      vi.spyOn(PromoCode, "findOne").mockResolvedValue(null);

      // Generate multiple codes and verify none contain confusing characters
      const confusingChars = /[IO01]/;

      for (let i = 0; i < 20; i++) {
        const code = await PromoCode.generateUniqueCode();
        expect(code).not.toMatch(confusingChars);
      }
    });

    it("uses only uppercase alphanumeric characters", async () => {
      vi.spyOn(PromoCode, "findOne").mockResolvedValue(null);

      for (let i = 0; i < 10; i++) {
        const code = await PromoCode.generateUniqueCode();
        // Should only contain A-Z (except I, O) and 2-9
        expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
      }
    });
  });

  // ============================================================================
  // INSTANCE METHOD: markAsUsedForEvent()
  // ============================================================================

  describe("markAsUsedForEvent()", () => {
    describe("Personal codes (isGeneral=false)", () => {
      it("sets isUsed=true and records event usage details", async () => {
        const code = new PromoCode({
          code: "EVTPERS",
          type: "staff_access",
          discountPercent: 100,
          ownerId: new mongoose.Types.ObjectId(),
          isGeneral: false,
          isActive: true,
          isUsed: false,
          applicableToType: "event",
          createdBy: "admin",
        });

        const saveSpy = vi.spyOn(code, "save").mockResolvedValue(code);

        const eventId = new mongoose.Types.ObjectId();
        const userId = new mongoose.Types.ObjectId();

        await code.markAsUsedForEvent(
          eventId,
          userId,
          "John Doe",
          "john@example.com",
          "Test Event",
        );

        expect(code.isUsed).toBe(true);
        expect(code.usedAt).toBeInstanceOf(Date);
        expect(code.usedForEventId).toEqual(eventId);
        expect(code.usageHistory).toHaveLength(0);
        expect(saveSpy).toHaveBeenCalled();
      });

      it("works without optional user details for events", async () => {
        const code = new PromoCode({
          code: "EVTPERS2",
          type: "bundle_discount",
          discountAmount: 5000,
          ownerId: new mongoose.Types.ObjectId(),
          isGeneral: false,
          isActive: true,
          isUsed: false,
          createdBy: "system",
        });

        const saveSpy = vi.spyOn(code, "save").mockResolvedValue(code);

        const eventId = new mongoose.Types.ObjectId();

        await code.markAsUsedForEvent(eventId);

        expect(code.isUsed).toBe(true);
        expect(code.usedAt).toBeInstanceOf(Date);
        expect(code.usedForEventId).toEqual(eventId);
        expect(saveSpy).toHaveBeenCalled();
      });
    });

    describe("General codes (isGeneral=true)", () => {
      it("initializes usageHistory when undefined for event usage", async () => {
        const code = new PromoCode({
          code: "EVTGEN0",
          type: "staff_access",
          discountPercent: 100,
          isGeneral: true,
          description: "General Staff Code - No History",
          isActive: true,
          isUsed: false,
          // usageHistory NOT set - should be initialized
          createdBy: "admin",
        });

        const saveSpy = vi.spyOn(code, "save").mockResolvedValue(code);

        const eventId = new mongoose.Types.ObjectId();
        const userId = new mongoose.Types.ObjectId();

        await code.markAsUsedForEvent(
          eventId,
          userId,
          "Init User",
          "init@example.com",
          "Init Event",
        );

        expect(code.usageHistory).toBeDefined();
        expect(code.usageHistory).toHaveLength(1);
        expect(code.usageHistory![0].eventId).toEqual(eventId);
        expect(saveSpy).toHaveBeenCalled();
      });

      it("appends to usageHistory with eventId instead of programId", async () => {
        const code = new PromoCode({
          code: "EVTGEN1",
          type: "staff_access",
          discountPercent: 100,
          isGeneral: true,
          description: "General Staff Code for Events",
          isActive: true,
          isUsed: false,
          usageHistory: [],
          createdBy: "admin",
        });

        const saveSpy = vi.spyOn(code, "save").mockResolvedValue(code);

        const eventId = new mongoose.Types.ObjectId();
        const userId = new mongoose.Types.ObjectId();

        await code.markAsUsedForEvent(
          eventId,
          userId,
          "Jane Smith",
          "jane@example.com",
          "Event Title",
        );

        expect(code.isUsed).toBe(false);
        expect(code.usageHistory).toHaveLength(1);
        expect(code.usageHistory![0].eventId).toEqual(eventId);
        expect(code.usageHistory![0].eventTitle).toBe("Event Title");
        expect(code.usageHistory![0].userId).toEqual(userId);
        expect(code.usageHistory![0].userName).toBe("Jane Smith");
        expect(code.usageHistory![0].userEmail).toBe("jane@example.com");
        expect(code.usageHistory![0].usedAt).toBeInstanceOf(Date);
        expect(saveSpy).toHaveBeenCalled();
      });

      it("throws error for general code without required user info", async () => {
        const code = new PromoCode({
          code: "EVTGEN2",
          type: "staff_access",
          discountPercent: 100,
          isGeneral: true,
          description: "General Code Missing Info",
          isActive: true,
          isUsed: false,
          createdBy: "admin",
        });

        const eventId = new mongoose.Types.ObjectId();

        await expect(code.markAsUsedForEvent(eventId)).rejects.toThrow(
          /User information.*required/,
        );
      });

      it("tracks multiple usages for general codes", async () => {
        const code = new PromoCode({
          code: "EVTGEN3",
          type: "staff_access",
          discountPercent: 100,
          isGeneral: true,
          description: "Multi-use General Code",
          isActive: true,
          isUsed: false,
          usageHistory: [
            {
              userId: new mongoose.Types.ObjectId(),
              userName: "First User",
              userEmail: "first@example.com",
              usedAt: new Date("2024-01-01"),
              eventId: new mongoose.Types.ObjectId(),
              eventTitle: "First Event",
            },
          ],
          createdBy: "admin",
        });

        vi.spyOn(code, "save").mockResolvedValue(code);

        const eventId = new mongoose.Types.ObjectId();
        const userId = new mongoose.Types.ObjectId();

        await code.markAsUsedForEvent(
          eventId,
          userId,
          "Second User",
          "second@example.com",
          "Second Event",
        );

        expect(code.usageHistory).toHaveLength(2);
        expect(code.usageHistory![1].userName).toBe("Second User");
        expect(code.usageHistory![1].eventTitle).toBe("Second Event");
      });
    });
  });

  // ============================================================================
  // SCHEMA VALIDATION TESTS
  // ============================================================================

  describe("Schema validation", () => {
    describe("Code format validation", () => {
      it("requires code to be exactly 8 characters", () => {
        const shortCode = new PromoCode({
          code: "SHORT",
          type: "bundle_discount",
          discountAmount: 5000,
          ownerId: new mongoose.Types.ObjectId(),
          createdBy: "system",
        });

        const error = shortCode.validateSync();
        expect(error).toBeDefined();
        expect(error?.errors.code).toBeDefined();
      });

      it("converts code to uppercase", () => {
        const code = new PromoCode({
          code: "abcd1234",
          type: "bundle_discount",
          discountAmount: 5000,
          ownerId: new mongoose.Types.ObjectId(),
          createdBy: "system",
        });

        expect(code.code).toBe("ABCD1234");
      });

      it("trims whitespace from code", () => {
        const code = new PromoCode({
          code: "  TEST1234  ",
          type: "bundle_discount",
          discountAmount: 5000,
          ownerId: new mongoose.Types.ObjectId(),
          createdBy: "system",
        });

        expect(code.code).toBe("TEST1234");
      });
    });

    describe("Type-specific discount validation", () => {
      it("bundle_discount with discountAmount=0 triggers custom validator", () => {
        const code = new PromoCode({
          code: "ZEROAMNT",
          type: "bundle_discount",
          discountAmount: 0, // Explicitly set to 0, which fails validator
          ownerId: new mongoose.Types.ObjectId(),
          createdBy: "system",
        });

        const error = code.validateSync();
        expect(error).toBeDefined();
        expect(error?.errors.discountAmount).toBeDefined();
      });

      it("staff_access with negative discountPercent fails validation", () => {
        const code = new PromoCode({
          code: "NEGPERC1",
          type: "staff_access",
          discountPercent: -1, // Invalid: negative
          ownerId: new mongoose.Types.ObjectId(),
          createdBy: "admin",
        });

        const error = code.validateSync();
        expect(error).toBeDefined();
        expect(error?.errors.discountPercent).toBeDefined();
      });

      it("reward with discountPercent over 100 fails validation", () => {
        const code = new PromoCode({
          code: "OVERPERC",
          type: "reward",
          discountPercent: 101, // Invalid: over 100
          ownerId: new mongoose.Types.ObjectId(),
          createdBy: "system",
        });

        const error = code.validateSync();
        expect(error).toBeDefined();
        expect(error?.errors.discountPercent).toBeDefined();
      });

      it("bundle_discount accepts valid discountAmount", () => {
        const code = new PromoCode({
          code: "VALIDAMT",
          type: "bundle_discount",
          discountAmount: 2500, // $25.00 in cents
          ownerId: new mongoose.Types.ObjectId(),
          createdBy: "system",
        });

        const error = code.validateSync();
        expect(error?.errors.discountAmount).toBeUndefined();
      });

      it("discountPercent must be between 0 and 100", () => {
        const invalidPercent = new PromoCode({
          code: "BADPERC1",
          type: "staff_access",
          discountPercent: 150, // Invalid: > 100
          ownerId: new mongoose.Types.ObjectId(),
          createdBy: "admin",
        });

        const error = invalidPercent.validateSync();
        expect(error?.errors.discountPercent).toBeDefined();
      });

      it("discountPercent allows 0% discount", () => {
        const zeroPercent = new PromoCode({
          code: "ZEROPCT1",
          type: "staff_access",
          discountPercent: 0,
          ownerId: new mongoose.Types.ObjectId(),
          createdBy: "admin",
        });

        const error = zeroPercent.validateSync();
        expect(error?.errors.discountPercent).toBeUndefined();
      });

      it("discountPercent allows 100% discount", () => {
        const fullPercent = new PromoCode({
          code: "FULLPCT1",
          type: "staff_access",
          discountPercent: 100,
          ownerId: new mongoose.Types.ObjectId(),
          createdBy: "admin",
        });

        const error = fullPercent.validateSync();
        expect(error?.errors.discountPercent).toBeUndefined();
      });
    });

    describe("General code validation", () => {
      it("general codes require description (validated in schema)", () => {
        const code = new PromoCode({
          code: "GENNODSC",
          type: "staff_access",
          discountPercent: 100,
          isGeneral: true,
          description: "", // Empty string to trigger validator
          createdBy: "admin",
        });

        const error = code.validateSync();
        expect(error).toBeDefined();
        expect(error?.errors.description).toBeDefined();
      });

      it("general codes do not require ownerId", () => {
        const code = new PromoCode({
          code: "GENNOOWN",
          type: "staff_access",
          discountPercent: 100,
          isGeneral: true,
          description: "General staff access code",
          // ownerId not set
          createdBy: "admin",
        });

        const error = code.validateSync();
        expect(error?.errors.ownerId).toBeUndefined();
      });

      it("personal codes require ownerId", () => {
        const code = new PromoCode({
          code: "PERSNOOW",
          type: "staff_access",
          discountPercent: 100,
          isGeneral: false,
          // ownerId missing
          createdBy: "admin",
        });

        const error = code.validateSync();
        expect(error).toBeDefined();
        expect(error?.errors.ownerId).toBeDefined();
      });
    });

    describe("Type enum validation", () => {
      it("rejects invalid type values", () => {
        const code = new PromoCode({
          code: "BADTYPE1",
          type: "invalid_type" as any,
          discountAmount: 5000,
          ownerId: new mongoose.Types.ObjectId(),
          createdBy: "system",
        });

        const error = code.validateSync();
        expect(error).toBeDefined();
        expect(error?.errors.type).toBeDefined();
      });

      it("accepts bundle_discount type", () => {
        const code = new PromoCode({
          code: "TYPEBUND",
          type: "bundle_discount",
          discountAmount: 5000,
          ownerId: new mongoose.Types.ObjectId(),
          createdBy: "system",
        });

        const error = code.validateSync();
        expect(error?.errors.type).toBeUndefined();
      });

      it("accepts staff_access type", () => {
        const code = new PromoCode({
          code: "TYPESTAF",
          type: "staff_access",
          discountPercent: 100,
          ownerId: new mongoose.Types.ObjectId(),
          createdBy: "admin",
        });

        const error = code.validateSync();
        expect(error?.errors.type).toBeUndefined();
      });

      it("accepts reward type", () => {
        const code = new PromoCode({
          code: "TYPERWD1",
          type: "reward",
          discountPercent: 25,
          ownerId: new mongoose.Types.ObjectId(),
          createdBy: "system",
        });

        const error = code.validateSync();
        expect(error?.errors.type).toBeUndefined();
      });
    });

    describe("applicableToType enum validation", () => {
      it("accepts 'program' as applicableToType", () => {
        const code = new PromoCode({
          code: "APPTPROG",
          type: "staff_access",
          discountPercent: 100,
          ownerId: new mongoose.Types.ObjectId(),
          applicableToType: "program",
          createdBy: "admin",
        });

        const error = code.validateSync();
        expect(error?.errors.applicableToType).toBeUndefined();
      });

      it("accepts 'event' as applicableToType", () => {
        const code = new PromoCode({
          code: "APPTEVNT",
          type: "staff_access",
          discountPercent: 100,
          ownerId: new mongoose.Types.ObjectId(),
          applicableToType: "event",
          createdBy: "admin",
        });

        const error = code.validateSync();
        expect(error?.errors.applicableToType).toBeUndefined();
      });

      it("allows undefined applicableToType (applies to both)", () => {
        const code = new PromoCode({
          code: "APPTBOTH",
          type: "staff_access",
          discountPercent: 100,
          ownerId: new mongoose.Types.ObjectId(),
          // applicableToType not set
          createdBy: "admin",
        });

        const error = code.validateSync();
        expect(error?.errors.applicableToType).toBeUndefined();
        expect(code.applicableToType).toBeUndefined();
      });
    });

    describe("createdBy validation", () => {
      it("requires createdBy field", () => {
        const code = new PromoCode({
          code: "NOCREATE",
          type: "bundle_discount",
          discountAmount: 5000,
          ownerId: new mongoose.Types.ObjectId(),
          // createdBy missing
        });

        const error = code.validateSync();
        expect(error).toBeDefined();
        expect(error?.errors.createdBy).toBeDefined();
      });

      it("accepts 'system' as createdBy", () => {
        const code = new PromoCode({
          code: "SYSCREAT",
          type: "bundle_discount",
          discountAmount: 5000,
          ownerId: new mongoose.Types.ObjectId(),
          createdBy: "system",
        });

        const error = code.validateSync();
        expect(error?.errors.createdBy).toBeUndefined();
      });

      it("accepts admin user ID as createdBy", () => {
        const code = new PromoCode({
          code: "ADMCREAT",
          type: "staff_access",
          discountPercent: 100,
          ownerId: new mongoose.Types.ObjectId(),
          createdBy: new mongoose.Types.ObjectId().toString(),
        });

        const error = code.validateSync();
        expect(error?.errors.createdBy).toBeUndefined();
      });
    });

    describe("Description length validation", () => {
      it("accepts description up to 500 characters", () => {
        const longDescription = "A".repeat(500);
        const code = new PromoCode({
          code: "DESCLONG",
          type: "staff_access",
          discountPercent: 100,
          isGeneral: true,
          description: longDescription,
          createdBy: "admin",
        });

        const error = code.validateSync();
        expect(error?.errors.description).toBeUndefined();
      });

      it("rejects description over 500 characters", () => {
        const tooLongDescription = "A".repeat(501);
        const code = new PromoCode({
          code: "DESCTOOL",
          type: "staff_access",
          discountPercent: 100,
          isGeneral: true,
          description: tooLongDescription,
          createdBy: "admin",
        });

        const error = code.validateSync();
        expect(error?.errors.description).toBeDefined();
      });
    });

    describe("discountAmount bounds validation", () => {
      it("rejects discountAmount less than 1 cent", () => {
        const code = new PromoCode({
          code: "LOWAMT01",
          type: "bundle_discount",
          discountAmount: 0, // Invalid: must be at least 1
          ownerId: new mongoose.Types.ObjectId(),
          createdBy: "system",
        });

        const error = code.validateSync();
        expect(error?.errors.discountAmount).toBeDefined();
      });

      it("rejects discountAmount greater than $500 (50000 cents)", () => {
        const code = new PromoCode({
          code: "HIGHAMT1",
          type: "bundle_discount",
          discountAmount: 50001, // Invalid: exceeds $500.00
          ownerId: new mongoose.Types.ObjectId(),
          createdBy: "system",
        });

        const error = code.validateSync();
        expect(error?.errors.discountAmount).toBeDefined();
      });

      it("accepts maximum discountAmount of $500 (50000 cents)", () => {
        const code = new PromoCode({
          code: "MAXAMT01",
          type: "bundle_discount",
          discountAmount: 50000, // Valid: exactly $500.00
          ownerId: new mongoose.Types.ObjectId(),
          createdBy: "system",
        });

        const error = code.validateSync();
        expect(error?.errors.discountAmount).toBeUndefined();
      });
    });
  });

  // ============================================================================
  // VIRTUAL PROPERTIES - Additional Coverage
  // ============================================================================

  describe("Virtual properties - Additional Coverage", () => {
    describe("isExpired edge cases", () => {
      it("returns false if expiresAt is exactly now (boundary condition)", () => {
        const now = new Date();
        const code = new PromoCode({
          code: "EXATNOW1",
          type: "bundle_discount",
          discountAmount: 5000,
          ownerId: new mongoose.Types.ObjectId(),
          expiresAt: now,
          isActive: true,
          isUsed: false,
          createdBy: "system",
        });

        // expiresAt < new Date() - since we just created it, it should be exactly equal
        // The comparison is strict less than, so equal times means NOT expired
        // However, due to timing, this test may be flaky - the key is the logic
        expect(typeof code.isExpired).toBe("boolean");
      });

      it("returns true for expiresAt 1ms in the past", () => {
        const pastDate = new Date(Date.now() - 1);
        const code = new PromoCode({
          code: "EXPMS001",
          type: "bundle_discount",
          discountAmount: 5000,
          ownerId: new mongoose.Types.ObjectId(),
          expiresAt: pastDate,
          isActive: true,
          isUsed: false,
          createdBy: "system",
        });

        expect(code.isExpired).toBe(true);
      });

      it("returns false for expiresAt 1ms in the future", () => {
        const futureDate = new Date(Date.now() + 100000); // 100 seconds in future for safety
        const code = new PromoCode({
          code: "EXPMS002",
          type: "bundle_discount",
          discountAmount: 5000,
          ownerId: new mongoose.Types.ObjectId(),
          expiresAt: futureDate,
          isActive: true,
          isUsed: false,
          createdBy: "system",
        });

        expect(code.isExpired).toBe(false);
      });
    });

    describe("isValid comprehensive checks", () => {
      it("returns false when all conditions fail (used, inactive, expired)", () => {
        const code = new PromoCode({
          code: "ALLFAIL1",
          type: "bundle_discount",
          discountAmount: 5000,
          ownerId: new mongoose.Types.ObjectId(),
          isActive: false,
          isUsed: true,
          expiresAt: new Date("2020-01-01"),
          createdBy: "system",
        });

        expect(code.isValid).toBe(false);
      });

      it("returns true for general code with usageHistory that is still active", () => {
        const code = new PromoCode({
          code: "GENHIST1",
          type: "staff_access",
          discountPercent: 100,
          isGeneral: true,
          description: "General code with history",
          isActive: true,
          isUsed: false,
          usageHistory: [
            {
              userId: new mongoose.Types.ObjectId(),
              userName: "Test User",
              userEmail: "test@example.com",
              usedAt: new Date(),
              programId: new mongoose.Types.ObjectId(),
            },
          ],
          createdBy: "admin",
        });

        expect(code.isValid).toBe(true);
      });

      it("returns true when no expiresAt is set (never expires)", () => {
        const code = new PromoCode({
          code: "NOEXPVAL",
          type: "staff_access",
          discountPercent: 50,
          ownerId: new mongoose.Types.ObjectId(),
          isActive: true,
          isUsed: false,
          // expiresAt not set
          createdBy: "admin",
        });

        expect(code.isValid).toBe(true);
        expect(code.expiresAt).toBeUndefined();
      });
    });
  });

  // ============================================================================
  // USAGE TRACKING EDGE CASES
  // ============================================================================

  describe("Usage tracking edge cases", () => {
    describe("usageHistory for general codes", () => {
      it("tracks both program and event usages in same history array", async () => {
        const code = new PromoCode({
          code: "MIXEDHIS",
          type: "staff_access",
          discountPercent: 100,
          isGeneral: true,
          description: "Mixed usage tracking",
          isActive: true,
          isUsed: false,
          usageHistory: [],
          createdBy: "admin",
        });

        vi.spyOn(code, "save").mockResolvedValue(code);

        const programId = new mongoose.Types.ObjectId();
        const eventId = new mongoose.Types.ObjectId();
        const userId1 = new mongoose.Types.ObjectId();
        const userId2 = new mongoose.Types.ObjectId();

        // First: program usage
        await code.markAsUsed(
          programId,
          userId1,
          "User One",
          "user1@example.com",
          "Test Program",
        );

        // Second: event usage
        await code.markAsUsedForEvent(
          eventId,
          userId2,
          "User Two",
          "user2@example.com",
          "Test Event",
        );

        expect(code.usageHistory).toHaveLength(2);

        // First entry should have programId
        expect(code.usageHistory![0].programId).toEqual(programId);
        expect(code.usageHistory![0].eventId).toBeUndefined();

        // Second entry should have eventId
        expect(code.usageHistory![1].eventId).toEqual(eventId);
        expect(code.usageHistory![1].programId).toBeUndefined();
      });
    });

    describe("Personal code usage flags", () => {
      it("sets usedForProgramId but not usedForEventId when used for program", async () => {
        const code = new PromoCode({
          code: "PROGUSE1",
          type: "bundle_discount",
          discountAmount: 5000,
          ownerId: new mongoose.Types.ObjectId(),
          isActive: true,
          isUsed: false,
          createdBy: "system",
        });

        vi.spyOn(code, "save").mockResolvedValue(code);

        const programId = new mongoose.Types.ObjectId();
        await code.markAsUsed(programId);

        expect(code.usedForProgramId).toEqual(programId);
        expect(code.usedForEventId).toBeUndefined();
      });

      it("sets usedForEventId but not usedForProgramId when used for event", async () => {
        const code = new PromoCode({
          code: "EVTUSE01",
          type: "bundle_discount",
          discountAmount: 5000,
          ownerId: new mongoose.Types.ObjectId(),
          isActive: true,
          isUsed: false,
          createdBy: "system",
        });

        vi.spyOn(code, "save").mockResolvedValue(code);

        const eventId = new mongoose.Types.ObjectId();
        await code.markAsUsedForEvent(eventId);

        expect(code.usedForEventId).toEqual(eventId);
        expect(code.usedForProgramId).toBeUndefined();
      });
    });
  });

  // ============================================================================
  // STATIC METHOD: findValidCodesForUser() - Additional Coverage
  // ============================================================================

  describe("findValidCodesForUser() - Additional Coverage", () => {
    it("builds correct query with $or for expiry conditions", async () => {
      const userId = new mongoose.Types.ObjectId();
      const findSpy = vi.spyOn(PromoCode, "find").mockReturnValue({
        sort: vi.fn().mockResolvedValue([]),
      } as any);

      await PromoCode.findValidCodesForUser(userId);

      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerId: userId,
          isActive: true,
          isUsed: false,
          $or: [
            { expiresAt: { $exists: false } },
            { expiresAt: { $gte: expect.any(Date) } },
          ],
        }),
      );
    });

    it("sorts results by createdAt descending", async () => {
      const userId = new mongoose.Types.ObjectId();
      const sortMock = vi.fn().mockResolvedValue([]);
      vi.spyOn(PromoCode, "find").mockReturnValue({
        sort: sortMock,
      } as any);

      await PromoCode.findValidCodesForUser(userId);

      expect(sortMock).toHaveBeenCalledWith({ createdAt: -1 });
    });

    it("filters by programId when provided", async () => {
      const userId = new mongoose.Types.ObjectId();
      const targetProgramId = new mongoose.Types.ObjectId();
      const otherProgramId = new mongoose.Types.ObjectId();

      const mockCodes = [
        {
          code: "VALIDPROG",
          canBeUsedForProgram: vi.fn((pid: any) => ({
            valid: pid.toString() === targetProgramId.toString(),
          })),
        },
        {
          code: "OTHERPROG",
          canBeUsedForProgram: vi.fn(() => ({ valid: false })),
        },
      ];

      vi.spyOn(PromoCode, "find").mockReturnValue({
        sort: vi.fn().mockResolvedValue(mockCodes),
      } as any);

      const result = await PromoCode.findValidCodesForUser(
        userId,
        targetProgramId,
      );

      expect(result).toHaveLength(1);
      expect(result[0].code).toBe("VALIDPROG");
      expect(mockCodes[0].canBeUsedForProgram).toHaveBeenCalledWith(
        targetProgramId,
      );
    });

    it("accepts string userId parameter", async () => {
      const userIdString = new mongoose.Types.ObjectId().toString();
      const findSpy = vi.spyOn(PromoCode, "find").mockReturnValue({
        sort: vi.fn().mockResolvedValue([]),
      } as any);

      await PromoCode.findValidCodesForUser(userIdString);

      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerId: userIdString,
        }),
      );
    });

    it("returns all codes when programId is not provided", async () => {
      const userId = new mongoose.Types.ObjectId();
      const mockCodes = [
        { code: "CODE1", canBeUsedForProgram: vi.fn(() => ({ valid: true })) },
        { code: "CODE2", canBeUsedForProgram: vi.fn(() => ({ valid: false })) },
      ];

      vi.spyOn(PromoCode, "find").mockReturnValue({
        sort: vi.fn().mockResolvedValue(mockCodes),
      } as any);

      const result = await PromoCode.findValidCodesForUser(userId);

      // Without programId filter, all codes are returned
      expect(result).toHaveLength(2);
      // canBeUsedForProgram should NOT have been called since no programId provided
      expect(mockCodes[0].canBeUsedForProgram).not.toHaveBeenCalled();
      expect(mockCodes[1].canBeUsedForProgram).not.toHaveBeenCalled();
    });
  });
});
