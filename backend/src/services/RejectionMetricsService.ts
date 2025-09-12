// Lightweight in-memory metrics for role assignment rejection flow.
// Intentionally simple; can be swapped with a real metrics backend later.
export type RejectionMetricKey =
  | "success"
  | "invalid"
  | "expired"
  | "replay"
  | "note_missing"
  | "rate_limited";

interface CounterMap {
  [k: string]: number;
}

class RejectionMetricsServiceClass {
  private counters: CounterMap = Object.create(null);

  increment(key: RejectionMetricKey): void {
    this.counters[key] = (this.counters[key] || 0) + 1;
  }

  getAll(): Record<string, number> {
    return { ...this.counters };
  }

  reset(): void {
    this.counters = Object.create(null);
  }
}

export const RejectionMetricsService = new RejectionMetricsServiceClass();
