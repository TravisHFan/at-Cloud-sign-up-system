# Security & Abuse Monitoring

This document summarizes current anti‑abuse surface, telemetry, and the operational playbook for public event publishing, registration, and short link usage.

## 1. Scope & Threat Model (Concise)

| Vector                    | Goal of Attacker                     | Mitigation                   | Signal                                                      | Escalation Threshold (guideline)             |
| ------------------------- | ------------------------------------ | ---------------------------- | ----------------------------------------------------------- | -------------------------------------------- |
| Registration flood (IP)   | Exhaust capacity / spam              | Sliding window IP limit      | registration_failures_total{reason="rate_limit_ip"}         | >5 IP blocks / 5m or sudden p95 latency jump |
| Targeted user/email abuse | Enumerate or spam attendee email     | Per-email sliding window     | registration_failures_total{reason="rate_limit_email"}      | >10 email blocks / 10m                       |
| Short link creation abuse | Key-space squatting / resource waste | Per-user + per-IP limits     | shortlink*create_failures_total{reason=rate_limit*\*}       | >10 user blocks or >20 IP blocks / hr        |
| Key probing               | Discover existing unpublished events | Publish validation & 404     | short_link_resolve_total{status="not_found"} (baseline low) | >5x normal baseline for 10m                  |
| Expired link re-use       | Misleading redirects                 | Expiry + redirect status 410 | short_link_redirect_total{status="expired"}                 | Spike with active event errors               |

## 2. Prometheus Metrics Inventory

- registration_attempts_total
- registration_failures_total{reason="rate_limit_ip"|"rate_limit_email"|"validation"|"capacity"|"duplicate"|...}
- shortlink_create_attempts_total
- shortlink_create_failures_total{reason="rate_limit_user"|"rate_limit_ip"|"custom_invalid"|"custom_reserved"|"custom_taken"|"validation"|"unauthenticated"|"other"}
- short_link_created_total
- short_link_resolve_total{status="active"|"expired"|"not_found"}
- short_link_redirect_total{status="active"|"expired"|"not_found"}
- short_link_resolve_duration_seconds (histogram)
- short_link_cache_hits_total{type="positive"|"negative"}
- short_link_cache_misses_total
- short_link_cache_evictions_total
- short_link_cache_stale_evictions_total{reason="expired"}
- short_link_cache_entries
- short_link_expire_events_total

## 3. Structured Rate Limit Log Schema

All RL breach logs (logger: `PublicRateLimit`, level: warn):

```
{
  scope: "registration" | "shortlink_create",
  limitType: "ip" | "email" | "user",
  ipCidr: "203.0.113.0/24",
  emailHash?: "<sha256:lower>" ,
  userId?: "<hex>",
  key: "<rl bucket key>",
  windowMs: number,
  limit: number,
  retryAfterSeconds: number,
  endpoint: "public_registration" | "shortlink_create"
}
```

## 4. Operational Playbook

| Symptom                        | First Checks                       | Mitigation Actions                          | Longer Term                                   |
| ------------------------------ | ---------------------------------- | ------------------------------------------- | --------------------------------------------- |
| Surge in `rate_limit_ip`       | Identify top offending IP CIDRs    | Temporarily lower IP limit or block at edge | Consider dynamic limit scaling by load        |
| Spike in `not_found` resolves  | Check deployment / key enumeration | Introduce soft captcha after threshold      | Add anomaly detection alert                   |
| Elevated resolve p95           | Review cache hit ratio metrics     | Increase cache size / TTL                   | Introduce secondary store (Redis)             |
| Many `custom_taken` failures   | Possible vanity squatting attempt  | Raise per-user limit or reserve prefix      | Implement ownership reclaim policy            |
| High `duplicate` registrations | Confirm frontend idempotency       | Debounce submit or add hidden token         | Strengthen backend idempotent token semantics |

## 5. Alerting Recommendations (Future)

| Metric Query                                                                          | Condition                | Severity |
| ------------------------------------------------------------------------------------- | ------------------------ | -------- |
| increase(registration_failures_total{reason="rate_limit_ip"}[5m]) > 25                | Hard block wave          | High     |
| increase(shortlink_create_failures_total{reason="rate_limit_user"}[10m]) > 50         | Automated creation abuse | Medium   |
| histogram_quantile(0.95, rate(short_link_resolve_duration_seconds_bucket[5m])) > 0.25 | Latency regression       | Medium   |
| increase(short_link_resolve_total{status="not_found"}[10m]) > 200                     | Probing                  | Medium   |

## 6. Future Improvements

- Add cardinality-safe unique IP gauge (approximate) via bloom/sketch.
- Export structured logs in JSON directly (today relies on logger formatting pipeline).
- Add per-role capacity depletion metric for projection alerts.
- Tie registration failure reasons into analytics dashboard.

## 7. Quick Runbooks Snippets

Rotate short link cache (emergency clear):

```ts
// In a maintenance script
// import { __TEST__ } from path-to ShortLinkService if exposed OR add safe admin endpoint (future)
```

Force expire all links for event (already on unpublish): publish toggle via existing admin endpoint.

## 8. Logging Format Toggle

For structured shipping (e.g. to Loki or CloudWatch Logs subscription filters), set:

```
LOG_FORMAT=json
```

Reverts to human-readable multi-line formatting when unset. JSON lines include keys: ts, level, message, context, metadata, error.

---

Last updated: (auto-update manually when editing)
