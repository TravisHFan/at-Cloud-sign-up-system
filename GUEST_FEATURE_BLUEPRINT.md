## 🎯 Guest Participation — Concise Blueprint

This blueprint reflects a near-complete guest feature. It captures what’s shipped, the essentials to keep, and the final polish steps.

### What’s shipped

- Public guest flow end-to-end: landing, register, confirmation, and self-service manage via token.
- Capacity-first validation includes users + guests; role UI shows “includes guests” for admins.
- Admin-only guests list and actions (update, cancel, move, resend manage link).
- Realtime parity for guest updates; privacy: non-admins don’t see guest info.
- Emails: guest confirmation + organizer notice; 24h reminders include guests (system messages to participants only).
- Rate limiting for guest signup (per ip+email); phone required with soft sanitization.
- Tests: backend and frontend suites cover flows, edge-cases, and realtime.
- “Exit Guest Registration” UX in GuestSidebar: clears transient state and redirects to Login with a thank-you; covered by RTL tests.
- Auto-migration on email verification (ON by default; disable with ENABLE_GUEST_AUTO_MIGRATION=false): backend verifyEmail triggers guest→user migration and returns a migration summary; frontend EmailVerification displays it; SignUp shows a notice.
- Admin-only guest migration scaffolding: service + controller + routes under /api/guest-migration used by admins and for testing.

Public routes: `/guest`, `/guest/register/:id`, `/guest/confirmation`, `/guest/manage/:token`

Admin routes:

- `GET /api/events/:eventId/guests`
- `/api/guest-migration/*` (admin-only)

Note: Use `npm test` for the unified suite.

### Recommended next steps

1. Optional self-serve prompt (post-login)

- Auto-migration is the default on email verification. Optionally, add a post-login prompt to recap migrated items and provide guidance.
- If adding: gate behind a flag, reuse verify response persisted to profile, and a small prompt component with dismiss/learn-more.

2. Rollout + observability

- Keep auto-migration disabled in CI via ENABLE_GUEST_AUTO_MIGRATION=false; document staging toggle behavior.
- Add lightweight logging/metrics around migration occurrences and outcomes; plan to remove the flag after a stable window.

3. A11y quick pass

- Add basic axe checks to guest pages and ensure focus management in `GuestEditModal`.

4. Messaging consistency

- Standardize duplicate/429 messages across guest forms and admin guest actions.

That’s it—keep the feature lean and stable.
