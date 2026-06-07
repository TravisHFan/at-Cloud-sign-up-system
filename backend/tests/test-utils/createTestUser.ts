import request from "supertest";
import app from "../../src/app";
import User from "../../src/models/User";

type TestGender = "male" | "female";

export interface CreateTestUserOptions {
  username?: string;
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  gender?: TestGender;
  isAtCloudLeader?: boolean;
  roleInAtCloud?: string;
  acceptTerms?: boolean;
  role?: string; // e.g. "Administrator" | "Super Admin" | etc.
  verified?: boolean;
}

export interface TestRegistrationPayload {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  gender: TestGender;
  isAtCloudLeader: boolean;
  roleInAtCloud?: string;
  acceptTerms: boolean;
}

const uniqueId = () => Math.random().toString(36).slice(2, 8);

export function buildTestRegistrationPayload(
  opts: CreateTestUserOptions = {},
): TestRegistrationPayload {
  const password = opts.password ?? "TestPass123!";
  const isAtCloudLeader = opts.isAtCloudLeader ?? false;
  const payload: TestRegistrationPayload = {
    username: opts.username ?? `user_${uniqueId()}`,
    email: opts.email ?? `${uniqueId()}@example.com`,
    password,
    confirmPassword: password,
    firstName: opts.firstName ?? "Test",
    lastName: opts.lastName ?? "User",
    gender: opts.gender ?? "male",
    isAtCloudLeader,
    acceptTerms: opts.acceptTerms ?? true,
  };

  if (isAtCloudLeader || opts.roleInAtCloud) {
    payload.roleInAtCloud = opts.roleInAtCloud ?? "Test Co-worker";
  }

  return payload;
}

/**
 * Registers a user via API (ensuring all middleware flows) then optionally elevates role & verification.
 * Returns the issued access token.
 */
export async function createAndLoginTestUser(opts: CreateTestUserOptions = {}) {
  const { role, verified = true } = opts;
  const base = buildTestRegistrationPayload(opts);

  await request(app).post("/api/auth/register").send(base).expect(201);

  // Elevate role & verify if needed
  if (verified || role) {
    await User.findOneAndUpdate(
      { email: base.email },
      {
        ...(verified ? { isVerified: true } : {}),
        ...(role ? { role } : {}),
      }
    );
  }

  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ emailOrUsername: base.email, password: base.password })
    .expect(200);

  // Get user ID from database
  const user = await User.findOne({ email: base.email });

  return {
    token: loginRes.body.data.accessToken as string,
    email: base.email,
    username: base.username,
    password: base.password,
    userId: user?._id.toString() || "",
    user,
    registrationPayload: base,
  };
}

export async function createAdminToken() {
  const { token } = await createAndLoginTestUser({ role: "Administrator" });
  return token;
}
