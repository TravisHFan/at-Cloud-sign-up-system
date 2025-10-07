/**
 * Utility to temporarily silence console methods during a test or code block.
 * Usage:
 *   await withSilencedConsole(['error', 'warn'], async () => { ... })
 */
import { vi } from "vitest";

type ConsoleMethod = "log" | "error" | "warn" | "info" | "debug";

export async function withSilencedConsole(
  methods: ConsoleMethod[],
  fn: () => any | Promise<any>
) {
  const originals: Partial<Record<ConsoleMethod, any>> = {};
  try {
    for (const m of methods) {
      originals[m] = (console as any)[m];
      (console as any)[m] = vi.fn();
    }
    return await fn();
  } finally {
    for (const m of methods) {
      if (originals[m]) {
        (console as any)[m] = originals[m];
      }
    }
  }
}

/**
 * Permanently silence (mock) console methods for a whole describe block.
 * Call inside a describe before tests run.
 */
export function silenceConsole(methods: ConsoleMethod[] = ["error", "warn"]) {
  const spies = methods.map((m) =>
    vi.spyOn(console as any, m).mockImplementation(() => {})
  );
  return () => spies.forEach((spy) => spy.mockRestore());
}
