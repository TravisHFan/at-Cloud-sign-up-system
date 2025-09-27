/** Lightweight in-memory counters for public endpoint abuse & rate limiting */
export type PublicAbuseMetricKey =
  | "registration_attempt"
  | "registration_block_rate_limit"
  | "shortlink_create_attempt"
  | "shortlink_create_block_rate_limit";

class PublicAbuseMetricsServiceClass {
  private counters: Record<string, number> = Object.create(null);

  increment(key: PublicAbuseMetricKey): void {
    this.counters[key] = (this.counters[key] || 0) + 1;
  }
  getAll(): Record<string, number> {
    return { ...this.counters };
  }
  reset(): void {
    this.counters = Object.create(null);
  }
}

export const PublicAbuseMetricsService = new PublicAbuseMetricsServiceClass();
export default PublicAbuseMetricsService;
