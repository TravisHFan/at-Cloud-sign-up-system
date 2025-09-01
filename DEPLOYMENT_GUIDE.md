# Deployment Guide

This guide covers production deployment notes for the @Cloud Sign-up System, with a focus on the event reminder scheduler and locking modes.

## Runtime flags

- SCHEDULER_ENABLED
  - true: Start EventReminderScheduler on this process
  - false/unset: Do not start the scheduler on this process
  - Default behavior: enabled in non-production environments; requires explicit true in production.
- SINGLE_INSTANCE_ENFORCE
  - true: Fail-fast if multiple backend workers are detected while using in-memory lock
  - false (default): Warn only
- WEB_CONCURRENCY / PM2_CLUSTER_MODE / NODE_APP_INSTANCE
  - Used to infer worker concurrency when SINGLE_INSTANCE_ENFORCE is enabled

## Render setup (Option A — single instance)

Recommended minimal setup for Render:

- Web Service (serves HTTP API)
  - Environment: production
  - Env: SCHEDULER_ENABLED=false (or unset)
  - Instances: 1+ (as needed for traffic)
- Background Worker (runs scheduler)
  - Environment: production
  - Env: SCHEDULER_ENABLED=true
  - Instances: 1 (single instance)

The server bootstrap gates scheduler start with:

- Enabled when `SCHEDULER_ENABLED === "true"` OR `NODE_ENV !== "production"`.
- Disabled otherwise. See logs: "⏸️ Event reminder scheduler disabled by env (SCHEDULER_ENABLED!=true)".

## Health endpoint for ops

Use the scheduler health endpoint to verify effective state:

- GET /api/system/scheduler

You can also manually trigger a one-off scheduler check (admin only):

- POST /api/system/scheduler/manual-trigger
  - Requires Administrator token
  - Useful for verifying reminder processing after enabling the worker

Sample response:

```
{
  "success": true,
  "schedulerEnabled": false,
  "status": {
    "isRunning": false,
    "uptime": 0,
    "runs": 0
  },
  "timestamp": "2025-08-31T12:34:56.000Z"
}
```

Interpretation:

- schedulerEnabled: whether this process is configured to start the scheduler (matches bootstrap logic)
- status.isRunning: whether the scheduler instance is currently running

## Option B (distributed lock — future)

If you later enable a distributed lock around EventReminderScheduler:

- Expose lockOwner and lockExpiresAt from the scheduler health endpoint for visibility.
- Keep the Background Worker at 1 instance unless you explicitly want failover; the distributed lock prevents overlap, not duplicate startup unless guarded.

## Troubleshooting

- Scheduler didn’t start in production:
  - Ensure SCHEDULER_ENABLED=true on the Background Worker
  - Check logs for disabled message or lock warnings
- Multiple workers with in-memory lock:
  - Set SINGLE_INSTANCE_ENFORCE=true to fail-fast
  - Reduce WEB_CONCURRENCY to 1 or disable cluster/PM2 modes
