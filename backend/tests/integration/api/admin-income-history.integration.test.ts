/**
 * Integration Tests for Admin Income History API
 * Tests role-based access control, pagination, search, and stats
 */
import request from "supertest";
import { describe, test, expect, afterEach, beforeAll } from "vitest";
import mongoose from "mongoose";
import app from "../../../src/app";
import User from "../../../src/models/User";
import Program from "../../../src/models/Program";
import Purchase from "../../../src/models/Purchase";
import { createAndLoginTestUser } from "../../test-utils/createTestUser";
import { ensureIntegrationDB } from "../setup/connect";

beforeAll(async () => {
  await ensureIntegrationDB();
});

// Helper function to create test program
async function createTestProgram(
  createdBy: mongoose.Types.ObjectId | string,
  overrides: Partial<any> = {}
) {
  return await Program.create({
    title: overrides.title || "Test Program",
    programType: "EMBA Mentor Circles",
    fullPriceTicket: 10000, // $100 in cents
    createdBy,
    ...overrides,
  });
}

// Helper function to create test purchase
async function createTestPurchase(
  userId: mongoose.Types.ObjectId | string,
  programId: mongoose.Types.ObjectId | string,
  overrides: Partial<any> = {}
) {
  const orderNum = `ORD-TEST-${Date.now()}-${Math.random()
    .toString(36)
    .substring(7)}`;
  return await Purchase.create({
    userId,
    programId,
    orderNumber: orderNum,
    fullPrice: 10000,
    classRepDiscount: 0,
    earlyBirdDiscount: 0,
    finalPrice: 10000,
    isClassRep: false,
    isEarlyBird: false,
    status: "completed",
    billingInfo: {
      fullName: "Test User",
      email: "test@example.com",
    },
    paymentMethod: {
      type: "card",
      cardBrand: "visa",
      last4: "4242",
    },
    purchaseDate: new Date(),
    ...overrides,
  });
}

describe("Admin Income History API", () => {
  afterEach(async () => {
    // Clean up test data
    await Purchase.deleteMany({});
    await Program.deleteMany({});
    await User.deleteMany({});
  });

  // ============================================================================
  // ROLE-BASED ACCESS CONTROL
  // ============================================================================

  describe("Role-Based Access Control", () => {
    test("Super Admin can access payment records", async () => {
      const { token, userId } = await createAndLoginTestUser({
        role: "Super Admin",
      });
      const program = await createTestProgram(userId);
      await createTestPurchase(userId, program._id);

      const res = await request(app)
        .get("/api/admin/purchases")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.purchases).toBeDefined();
      expect(Array.isArray(res.body.data.purchases)).toBe(true);
    });

    test("Administrator can access payment records", async () => {
      const { token, userId } = await createAndLoginTestUser({
        role: "Administrator",
      });
      const program = await createTestProgram(userId);
      await createTestPurchase(userId, program._id);

      const res = await request(app)
        .get("/api/admin/purchases")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.purchases).toBeDefined();
    });

    test("Leader cannot access payment records", async () => {
      const { token } = await createAndLoginTestUser({ role: "Leader" });

      const res = await request(app)
        .get("/api/admin/purchases")
        .set("Authorization", `Bearer ${token}`)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Access denied");
    });

    test("Participant cannot access payment records", async () => {
      const { token } = await createAndLoginTestUser({ role: "Participant" });

      const res = await request(app)
        .get("/api/admin/purchases")
        .set("Authorization", `Bearer ${token}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    test("Guest Expert cannot access payment records", async () => {
      const { token } = await createAndLoginTestUser({ role: "Guest Expert" });

      const res = await request(app)
        .get("/api/admin/purchases")
        .set("Authorization", `Bearer ${token}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    test("requires authentication", async () => {
      const res = await request(app).get("/api/admin/purchases").expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  // ============================================================================
  // PAGINATION
  // ============================================================================

  describe("Pagination", () => {
    test("returns paginated results with default limit of 20", async () => {
      const { token, userId } = await createAndLoginTestUser({
        role: "Super Admin",
      });
      const program = await createTestProgram(userId);

      // Create 25 purchases
      for (let i = 0; i < 25; i++) {
        await createTestPurchase(userId, program._id);
      }

      const res = await request(app)
        .get("/api/admin/purchases")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.purchases.length).toBeLessThanOrEqual(20);
      expect(res.body.data.pagination).toBeDefined();
      expect(res.body.data.pagination.page).toBe(1);
      expect(res.body.data.pagination.limit).toBe(20);
      expect(res.body.data.pagination.total).toBe(25);
      expect(res.body.data.pagination.totalPages).toBe(2);
    });

    test("respects page parameter", async () => {
      const { token, userId } = await createAndLoginTestUser({
        role: "Administrator",
      });
      const program = await createTestProgram(userId);

      // Create 25 purchases
      for (let i = 0; i < 25; i++) {
        await createTestPurchase(userId, program._id);
      }

      const res = await request(app)
        .get("/api/admin/purchases?page=2")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.pagination.page).toBe(2);
      expect(res.body.data.purchases.length).toBe(5); // Remaining items on page 2
    });

    test("respects custom limit parameter", async () => {
      const { token, userId } = await createAndLoginTestUser({
        role: "Super Admin",
      });
      const program = await createTestProgram(userId);

      // Create 15 purchases
      for (let i = 0; i < 15; i++) {
        await createTestPurchase(userId, program._id);
      }

      const res = await request(app)
        .get("/api/admin/purchases?limit=10")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.purchases.length).toBe(10);
      expect(res.body.data.pagination.limit).toBe(10);
    });

    test("enforces maximum limit of 100", async () => {
      const { token, userId } = await createAndLoginTestUser({
        role: "Super Admin",
      });
      const program = await createTestProgram(userId);

      await createTestPurchase(userId, program._id);

      const res = await request(app)
        .get("/api/admin/purchases?limit=500")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.pagination.limit).toBe(100); // Capped at 100
    });
  });

  // ============================================================================
  // SEARCH FUNCTIONALITY
  // ============================================================================

  describe("Search Functionality", () => {
    test("searches by user name", async () => {
      const { token, userId: adminId } = await createAndLoginTestUser({
        role: "Super Admin",
        email: "admin@test.com",
      });

      const user1 = await User.create({
        username: "johnsmith",
        email: "john@test.com",
        firstName: "John",
        lastName: "Smith",
        password: "Password123",
        role: "Participant",
        isEmailVerified: true,
      });

      const user2 = await User.create({
        username: "janedoe",
        email: "jane@test.com",
        firstName: "Jane",
        lastName: "Doe",
        password: "Password123",
        role: "Participant",
        isEmailVerified: true,
      });

      const program = await createTestProgram(adminId);
      await createTestPurchase(user1._id, program._id);
      await createTestPurchase(user2._id, program._id);

      const res = await request(app)
        .get("/api/admin/purchases?search=john")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.purchases.length).toBeGreaterThan(0);
      const matchingPurchase = res.body.data.purchases.find((p: any) =>
        p.user.name.toLowerCase().includes("john")
      );
      expect(matchingPurchase).toBeDefined();
    });

    test("searches by user email", async () => {
      const { token, userId: adminId } = await createAndLoginTestUser({
        role: "Administrator",
        email: "admin@test.com",
      });

      const user = await User.create({
        username: "testuser",
        email: "unique.email@test.com",
        firstName: "Test",
        lastName: "User",
        password: "Password123",
        role: "Participant",
        isEmailVerified: true,
      });

      const program = await createTestProgram(adminId);
      await createTestPurchase(user._id, program._id);

      const res = await request(app)
        .get("/api/admin/purchases?search=unique.email")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.purchases.length).toBeGreaterThan(0);
    });

    test("searches by program name", async () => {
      const { token, userId } = await createAndLoginTestUser({
        role: "Super Admin",
      });

      const program1 = await createTestProgram(userId, {
        title: "Advanced Leadership Program",
      });
      const program2 = await createTestProgram(userId, {
        title: "Basic Mentorship Program",
      });

      await createTestPurchase(userId, program1._id);
      await createTestPurchase(userId, program2._id);

      const res = await request(app)
        .get("/api/admin/purchases?search=leadership")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.purchases.length).toBeGreaterThan(0);
      const matchingPurchase = res.body.data.purchases.find((p: any) =>
        p.program.name.toLowerCase().includes("leadership")
      );
      expect(matchingPurchase).toBeDefined();
    });

    test("searches by order number", async () => {
      const { token, userId } = await createAndLoginTestUser({
        role: "Super Admin",
      });

      const program = await createTestProgram(userId);
      const purchase = await createTestPurchase(userId, program._id, {
        orderNumber: "ORD-SPECIAL-12345",
      });

      const res = await request(app)
        .get("/api/admin/purchases?search=SPECIAL")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.purchases.length).toBeGreaterThan(0);
      const matchingPurchase = res.body.data.purchases.find(
        (p: any) => p.orderNumber === "ORD-SPECIAL-12345"
      );
      expect(matchingPurchase).toBeDefined();
    });

    test("returns empty array for non-matching search", async () => {
      const { token, userId } = await createAndLoginTestUser({
        role: "Super Admin",
      });

      const program = await createTestProgram(userId);
      await createTestPurchase(userId, program._id);

      const res = await request(app)
        .get("/api/admin/purchases?search=nonexistentquery12345")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.purchases.length).toBe(0);
    });
  });

  // ============================================================================
  // STATUS FILTERING
  // ============================================================================

  describe("Status Filtering", () => {
    test("filters by completed status", async () => {
      const { token, userId } = await createAndLoginTestUser({
        role: "Super Admin",
      });

      const program = await createTestProgram(userId);
      await createTestPurchase(userId, program._id, { status: "completed" });
      await createTestPurchase(userId, program._id, { status: "pending" });
      await createTestPurchase(userId, program._id, { status: "failed" });

      const res = await request(app)
        .get("/api/admin/purchases?status=completed")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(
        res.body.data.purchases.every((p: any) => p.status === "completed")
      ).toBe(true);
    });

    test("filters by pending status", async () => {
      const { token, userId } = await createAndLoginTestUser({
        role: "Administrator",
      });

      const program = await createTestProgram(userId);
      await createTestPurchase(userId, program._id, { status: "completed" });
      await createTestPurchase(userId, program._id, { status: "pending" });

      const res = await request(app)
        .get("/api/admin/purchases?status=pending")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.purchases.every((p: any) => p.status === "pending")).toBe(
        true
      );
    });

    test("returns all statuses when status=all", async () => {
      const { token, userId } = await createAndLoginTestUser({
        role: "Super Admin",
      });

      const program = await createTestProgram(userId);
      await createTestPurchase(userId, program._id, { status: "completed" });
      await createTestPurchase(userId, program._id, { status: "pending" });
      await createTestPurchase(userId, program._id, { status: "failed" });

      const res = await request(app)
        .get("/api/admin/purchases?status=all")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.purchases.length).toBe(3);
    });
  });

  // ============================================================================
  // PAYMENT STATISTICS
  // ============================================================================

  describe("Payment Statistics", () => {
    test("Super Admin can access payment stats", async () => {
      const { token } = await createAndLoginTestUser({ role: "Super Admin" });

      const res = await request(app)
        .get("/api/admin/purchases/stats")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.stats).toBeDefined();
      expect(res.body.data.stats.totalRevenue).toBeDefined();
      expect(res.body.data.stats.totalPurchases).toBeDefined();
      expect(res.body.data.stats.uniqueBuyers).toBeDefined();
    });

    test("Administrator can access payment stats", async () => {
      const { token } = await createAndLoginTestUser({
        role: "Administrator",
      });

      const res = await request(app)
        .get("/api/admin/purchases/stats")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.stats).toBeDefined();
    });

    test("Leader cannot access payment stats", async () => {
      const { token } = await createAndLoginTestUser({ role: "Leader" });

      const res = await request(app)
        .get("/api/admin/purchases/stats")
        .set("Authorization", `Bearer ${token}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    test("calculates correct total revenue from completed purchases", async () => {
      const { token, userId } = await createAndLoginTestUser({
        role: "Super Admin",
      });

      const program = await createTestProgram(userId);
      await createTestPurchase(userId, program._id, {
        status: "completed",
        finalPrice: 10000,
      });
      await createTestPurchase(userId, program._id, {
        status: "completed",
        finalPrice: 15000,
      });
      await createTestPurchase(userId, program._id, {
        status: "pending",
        finalPrice: 5000,
      }); // Should not count

      const res = await request(app)
        .get("/api/admin/purchases/stats")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.stats.totalRevenue).toBe(25000); // Only completed
    });

    test("counts purchases by status correctly", async () => {
      const { token, userId } = await createAndLoginTestUser({
        role: "Super Admin",
      });

      const program = await createTestProgram(userId);
      await createTestPurchase(userId, program._id, { status: "completed" });
      await createTestPurchase(userId, program._id, { status: "completed" });
      await createTestPurchase(userId, program._id, { status: "pending" });
      await createTestPurchase(userId, program._id, { status: "failed" });

      const res = await request(app)
        .get("/api/admin/purchases/stats")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.stats.totalPurchases).toBe(2); // Completed only
      expect(res.body.data.stats.pendingPurchases).toBe(1);
      expect(res.body.data.stats.failedPurchases).toBe(1);
    });

    test("counts unique buyers correctly", async () => {
      const { token, userId: adminId } = await createAndLoginTestUser({
        role: "Super Admin",
        email: "admin@test.com",
      });

      const user1 = await User.create({
        username: "buyer1",
        email: "buyer1@test.com",
        password: "Password123",
        role: "Participant",
        isEmailVerified: true,
      });

      const user2 = await User.create({
        username: "buyer2",
        email: "buyer2@test.com",
        password: "Password123",
        role: "Participant",
        isEmailVerified: true,
      });

      const program = await createTestProgram(adminId);
      await createTestPurchase(user1._id, program._id, { status: "completed" });
      await createTestPurchase(user1._id, program._id, { status: "completed" }); // Same user, 2 purchases
      await createTestPurchase(user2._id, program._id, { status: "completed" });

      const res = await request(app)
        .get("/api/admin/purchases/stats")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.stats.uniqueBuyers).toBe(2); // user1 and user2
    });
  });

  // ============================================================================
  // DATA ACCURACY
  // ============================================================================

  describe("Data Accuracy", () => {
    test("returns complete purchase information", async () => {
      const { token, userId: adminId } = await createAndLoginTestUser({
        role: "Super Admin",
        email: "admin@test.com",
      });

      const user = await User.create({
        username: "testbuyer",
        email: "buyer@test.com",
        firstName: "Test",
        lastName: "Buyer",
        password: "Password123",
        role: "Participant",
        isEmailVerified: true,
      });

      const program = await createTestProgram(adminId, {
        title: "Complete Test Program",
      });

      await createTestPurchase(user._id, program._id, {
        orderNumber: "ORD-COMPLETE-TEST",
        fullPrice: 20000,
        classRepDiscount: 2000,
        earlyBirdDiscount: 1000,
        finalPrice: 17000,
        isClassRep: true,
        isEarlyBird: true,
        promoCode: "TESTCODE",
        promoDiscountAmount: 0,
      });

      const res = await request(app)
        .get("/api/admin/purchases")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const purchase = res.body.data.purchases[0];
      expect(purchase.orderNumber).toBe("ORD-COMPLETE-TEST");
      expect(purchase.user.name).toContain("Test Buyer");
      expect(purchase.user.email).toBe("buyer@test.com");
      expect(purchase.program.name).toBe("Complete Test Program");
      expect(purchase.fullPrice).toBe(20000);
      expect(purchase.classRepDiscount).toBe(2000);
      expect(purchase.earlyBirdDiscount).toBe(1000);
      expect(purchase.finalPrice).toBe(17000);
      expect(purchase.isClassRep).toBe(true);
      expect(purchase.isEarlyBird).toBe(true);
      expect(purchase.promoCode).toBe("TESTCODE");
      expect(purchase.status).toBe("completed");
    });

    test("populates user and program data correctly", async () => {
      const { token, userId: adminId } = await createAndLoginTestUser({
        role: "Administrator",
      });

      const user = await User.create({
        username: "buyer",
        email: "buyer@test.com",
        firstName: "John",
        lastName: "Doe",
        password: "Password123",
        role: "Participant",
        isEmailVerified: true,
      });

      const program = await createTestProgram(adminId, {
        title: "Populated Program",
      });

      await createTestPurchase(user._id, program._id);

      const res = await request(app)
        .get("/api/admin/purchases")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const purchase = res.body.data.purchases[0];
      expect(purchase.user).toBeDefined();
      expect(purchase.user.id).toBeDefined();
      expect(purchase.user.name).toBe("John Doe");
      expect(purchase.program).toBeDefined();
      expect(purchase.program.id).toBeDefined();
      expect(purchase.program.name).toBe("Populated Program");
    });

    test("sorts purchases by createdAt descending (newest first)", async () => {
      const { token, userId } = await createAndLoginTestUser({
        role: "Super Admin",
      });

      const program = await createTestProgram(userId);

      // Create purchases with different timestamps
      const old = await createTestPurchase(userId, program._id, {
        createdAt: new Date("2024-01-01"),
      });
      const newer = await createTestPurchase(userId, program._id, {
        createdAt: new Date("2024-06-01"),
      });
      const newest = await createTestPurchase(userId, program._id, {
        createdAt: new Date("2024-12-01"),
      });

      const res = await request(app)
        .get("/api/admin/purchases")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.purchases.length).toBe(3);
      // Newest should be first
      expect(
        new Date(res.body.data.purchases[0].createdAt).getTime()
      ).toBeGreaterThan(new Date(res.body.data.purchases[1].createdAt).getTime());
    });
  });
});
