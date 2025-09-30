import { expect } from "vitest";
import type { Response } from "supertest";

/**
 * Assert a 422 publish validation response containing MISSING_REQUIRED_FIELDS aggregate.
 * Provides clearer failure messages than repeating inline expectations.
 */
export function assertMissingFields422(
  res: Response,
  expectedMissing: string[],
  opts: { format?: string } = {}
) {
  expect(
    res.status,
    `Expected 422 status, got ${res.status} body=${JSON.stringify(res.body)}`
  ).toBe(422);
  expect(res.body.code).toBe("MISSING_REQUIRED_FIELDS");
  if (opts.format) {
    expect(res.body.format).toBe(opts.format);
  }
  const missing = (res.body.missing || []).slice().sort();
  expect(missing).toEqual(expectedMissing.slice().sort());
  // Per-field errors contain individual MISSING codes
  const perField = (res.body.errors || []).filter(
    (e: any) => e.code === "MISSING"
  );
  for (const field of expectedMissing) {
    const has = perField.find((e: any) => e.field === field);
    expect(has, `Missing per-field error for ${field}`).toBeTruthy();
  }
}
