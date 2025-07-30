import jwt from "jsonwebtoken";
import { IUser } from "../../src/models/User";

export const createAuthenticatedRequest = async (
  user: IUser
): Promise<string> => {
  if (!user || !user._id) {
    throw new Error("User must have a valid _id to generate token");
  }

  const payload = {
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  };

  const secret = process.env.JWT_ACCESS_SECRET || "your-access-secret-key";
  return jwt.sign(payload, secret, {
    expiresIn: "1h",
    issuer: "atcloud-system",
    audience: "atcloud-users",
  });
};
