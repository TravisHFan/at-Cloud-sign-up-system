import request from "supertest";
import app from "../../src/app";
import User from "../../src/models/User";

export interface CreateTestUserOptions {
  username?: string;
  email?: string;
  password?: string;
  role?: string; // e.g. "Administrator" | "Super Admin" | etc.
  verified?: boolean;
}

/**
 * Registers a user via API (ensuring all middleware flows) then optionally elevates role & verification.
 * Returns the issued access token.
 */
export async function createAndLoginTestUser(opts: CreateTestUserOptions = {}) {
  const {
    username = `user_${Math.random().toString(36).slice(2, 8)}`,
    email = `${Math.random().toString(36).slice(2, 8)}@example.com`,
    password = "TestPass123!",
    role,
    verified = true,
  } = opts;

  const base = {
    username,
    email,
    password,
    confirmPassword: password,
    firstName: "Test",
    lastName: "User",
    gender: "male",
    isAtCloudLeader: false,
    acceptTerms: true,
  };

  await request(app).post("/api/auth/register").send(base).expect(201);

  // Elevate role & verify if needed
  if (verified || role) {
    await User.findOneAndUpdate(
      { email },
      {
        ...(verified ? { isVerified: true } : {}),
        ...(role ? { role } : {}),
      }
    );
  }

  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ emailOrUsername: email, password })
    .expect(200);

  // Get user ID from database
  const user = await User.findOne({ email });

  return {
    token: loginRes.body.data.accessToken as string,
    email,
    username,
    userId: user?._id.toString() || "",
  };
}

export async function createAdminToken() {
  const { token } = await createAndLoginTestUser({ role: "Administrator" });
  return token;
}
