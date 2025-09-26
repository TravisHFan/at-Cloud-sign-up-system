import crypto from "crypto";
import ShortLink from "../models/ShortLink";

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/**
 * Generate a random base62 key of length between 6 and 8 (inclusive) by default.
 * Retries (at most `maxCollisionRetries`) if a collision is detected in DB.
 */
export async function generateUniqueShortKey(options?: {
  minLength?: number;
  maxLength?: number;
  maxCollisionRetries?: number;
}): Promise<string> {
  const minLength = options?.minLength ?? 6;
  const maxLength = options?.maxLength ?? 8;
  const maxCollisionRetries = options?.maxCollisionRetries ?? 5;
  if (minLength < 4 || maxLength < minLength) {
    throw new Error("Invalid key length bounds");
  }

  for (let attempt = 0; attempt <= maxCollisionRetries; attempt++) {
    const length =
      minLength === maxLength
        ? minLength
        : randomIntInclusive(minLength, maxLength);
    const key = randomBase62(length);
    // Collision check (lean for speed)
    const exists = await ShortLink.findOne({ key }).select("_id").lean();
    if (!exists) return key;
  }
  throw new Error("Failed to generate unique short link key after retries");
}

function randomBase62(length: number): string {
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    // Map byte (0-255) into base62 index (0-61)
    out += BASE62[bytes[i] % 62];
  }
  return out;
}

function randomIntInclusive(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function isBase62(str: string): boolean {
  return /^[0-9A-Za-z]+$/.test(str);
}
