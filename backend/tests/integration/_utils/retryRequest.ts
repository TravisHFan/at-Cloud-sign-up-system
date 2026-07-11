/**
 * Retry utility for flaky HTTP requests in integration tests.
 *
 * Handles transient connection errors like "Parse Error: Expected HTTP/"
 * that can occur when running many tests in rapid succession.
 */

import type { Test, Response } from "supertest";

/**
 * Wraps a supertest request with retry logic for connection errors.
 * Retries up to `maxRetries` times on specific network-level failures.
 *
 * Usage:
 * ```ts
 * const response = await retryRequest(() =>
 *   request(app).get('/api/users').set('Authorization', `Bearer ${token}`)
 * );
 * ```
 */
export async function retryRequest(
  testRequest: Test | (() => Test),
  maxRetries = 2,
  delayMs = 100,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const requestForAttempt =
        typeof testRequest === "function" ? testRequest() : testRequest;
      const response = await requestForAttempt;
      return response;
    } catch (error: any) {
      lastError = error;

      // Only retry on specific connection-level errors
      const isRetryable =
        error.message?.includes("Parse Error: Expected HTTP") ||
        error.message?.includes("ECONNRESET") ||
        error.message?.includes("ECONNREFUSED") ||
        error.code === "ECONNRESET" ||
        error.code === "ECONNREFUSED";

      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}
