# Observability Guide

Last updated: 2025-09-05

Purpose

This document explains how to use our new observability features: request correlation, structured logs, and basic operational metrics. It’s aimed at developers running locally and during investigations.

Overview

- Correlation IDs

  - Every HTTP request carries a correlation ID (header: x-correlation-id). If the client provides one, we propagate it; otherwise we generate a UUID.
  - The middleware attaches the ID to req.correlationId and adds it to the response headers.
  - Use CorrelatedLogger.fromRequest(req) to emit logs tied to the same correlation ID.

- Structured logging

  - LoggerService emits JSON logs with level, context, and metadata. CorrelatedLogger adds request/user context.
  - For HTTP flows, RequestMonitorService logs start and completion with normalized paths and correlation IDs.
  - In tests, logs are kept brief, but we still emit the key HTTP request summaries your tests assert.

- Metrics endpoint
  - GET /api/system/metrics returns a PII-safe snapshot:
    - Totals for last hour/minute, approximate requests/second
    - Aggregated endpoint metrics: count, avg latency, errorCount, unique IPs/agents
    - Top IPs and User-Agents
    - SuspiciousPatterns (e.g., potential polling)
    - New fields:
      - uniques: ipsLastHour, userAgentsLastHour
      - errors: lastHour, rateLastHour (auth 401/403 excluded from error counts)
  - Use for quick health checks locally or as a base for future monitoring exports.

How to use locally

- Trace a request

  1. Send any backend request; note x-correlation-id in the response headers
  2. Grep logs for that ID to see end-to-end flow, including statusCode and responseTime

- Check metrics

  - Hit GET /api/system/metrics and inspect the JSON for hotspots or anomalies.

- Add correlated logs in code
  - In an Express handler:
    - const clog = CorrelatedLogger.fromRequest(req, "SomeContext");
    - clog.info("Doing X", "ServiceName", { key: value })
    - clog.error("Failed Y", err, "ServiceName", { extra: true })

Notes and guardrails

- Do not log PII
  - IDs are okay; emails/phones should be avoided in logs. If unavoidable for debugging, gate behind an explicit DEV-only flag and remove before committing.
- Keep tests stable
  - Preserve console summaries in places where tests assert them (e.g., HTTP request lines), while also emitting structured logs.
- Logger instance-level behavior
  - Log level is captured when a logger instance is created. If you change the global/base log level during a test, create a new logger instance (or call child() after the change) to pick up the new level.
- Performance budgets
  - Our perf smoke tests track generous budgets for analytics export. Use them to catch regressions, not to micro-optimize.

Ops endpoints and quick refs

- Health: GET /api/system/health → uptime + lock diagnostics
- Metrics: GET /api/system/metrics → PII-safe counters/gauges
- Scheduler status: GET /api/system/scheduler
- Manual scheduler trigger (admin): POST /api/system/scheduler/manual-trigger

Console parity

- LoggerService maintains console.\* parity so local workflows remain readable while structured logs are emitted in parallel.

Next steps

- Expand structured logging to remaining services
- Finalize alert/report fields in RequestMonitorService and wire to metrics
- Consider exporting metrics to an external system in production
