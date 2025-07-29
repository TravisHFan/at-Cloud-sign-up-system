import jwt from "jsonwebtoken";
import { IUser } from "../../src/models/User";

export const createAuthenticatedRequest = async (
  user: IUser
): Promise<string> => {
  const payload = {
    id: user._id,
    email: user.email,
    role: user.role,
  };

  const secret = process.env.JWT_SECRET || "test-secret-key";
  return jwt.sign(payload, secret, { expiresIn: "1h" });
};
