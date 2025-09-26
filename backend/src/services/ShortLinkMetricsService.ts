// In-memory metrics for Short Link feature. Mirrors pattern used by RejectionMetricsService.
// This provides lightweight counters that can later be replaced by Prometheus or another backend.

export type ShortLinkMetricKey =
  | "created"
  | "resolved_active"
  | "resolved_expired"
  | "resolved_not_found"
  | "redirect_active"
  | "redirect_expired"
  | "redirect_not_found";

class ShortLinkMetricsServiceClass {
  private counters: Record<string, number> = Object.create(null);

  increment(key: ShortLinkMetricKey): void {
    this.counters[key] = (this.counters[key] || 0) + 1;
  }

  getAll(): Record<string, number> {
    return { ...this.counters };
  }

  reset(): void {
    this.counters = Object.create(null);
  }
}

export const ShortLinkMetricsService = new ShortLinkMetricsServiceClass();
export default ShortLinkMetricsService;
