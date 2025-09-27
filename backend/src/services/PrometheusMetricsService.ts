import client from "prom-client";

// Centralized Prometheus metrics registration.
// We keep this lightweight; prom-client default metrics can be enabled if needed later.

const register = new client.Registry();

// Optional: allow disabling if ever needed via env
const ENABLE_PROM: boolean = process.env.ENABLE_PROMETHEUS !== "false";

// Short link counters
export const shortLinkCreatedCounter = new client.Counter({
  name: "short_link_created_total",
  help: "Total number of short links created (idempotent creates not counted)",
  registers: [register],
});

export const shortLinkResolveCounter = new client.Counter({
  name: "short_link_resolve_total",
  help: "Short link status resolutions by outcome",
  labelNames: ["status"],
  registers: [register],
});

export const shortLinkRedirectCounter = new client.Counter({
  name: "short_link_redirect_total",
  help: "Short link redirect outcomes (HTTP path /s/:key)",
  labelNames: ["status"],
  registers: [register],
});

export const shortLinkResolveDuration = new client.Histogram({
  name: "short_link_resolve_duration_seconds",
  help: "Duration of short link resolution handler (controller layer)",
  labelNames: ["status"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2],
  registers: [register],
});

// Registration attempt counters (placeholders for negative test metrics to be instrumented later)
export const registrationAttemptCounter = new client.Counter({
  name: "registration_attempts_total",
  help: "Total registration attempts (successful + failed)",
  registers: [register],
});

export const registrationFailureCounter = new client.Counter({
  name: "registration_failures_total",
  help: "Total failed registration attempts categorized by reason",
  labelNames: ["reason"],
  registers: [register],
});

// Short link creation attempt/failure counters
export const shortLinkCreateAttemptCounter = new client.Counter({
  name: "shortlink_create_attempts_total",
  help: "Total short link creation attempts (successful + failed)",
  registers: [register],
});

export const shortLinkCreateFailureCounter = new client.Counter({
  name: "shortlink_create_failures_total",
  help: "Total short link creation failures categorized by reason",
  labelNames: ["reason"],
  registers: [register],
});

// Expire events (e.g., unpublish) for observability
export const shortLinkExpireCounter = new client.Counter({
  name: "short_link_expire_events_total",
  help: "Number of bulk short link expiration events triggered (e.g., unpublish)",
  registers: [register],
});

// Provide text exposition
export async function getMetrics(): Promise<string> {
  if (!ENABLE_PROM) return ""; // minimal guard
  return register.metrics();
}

export function isPromEnabled(): boolean {
  return ENABLE_PROM;
}

// Export register for potential external use (tests)
export { register as prometheusRegistry };
