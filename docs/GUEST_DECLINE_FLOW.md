# Guest Invitation Decline Flow

## Overview

Invited guests now receive an email containing an optional **Decline This Invitation** button. This enables organizers to quickly free a role slot and gather optional context when an invited guest cannot participate.

## Lifecycle

1. Guest is invited (guest registration created server-side using existing flow with `inviterName` flag).
2. Backend generates a JWT decline token (14‑day expiry) via `createGuestInvitationDeclineToken` and embeds it in the confirmation/invitation email.
3. Guest clicks link: `/guest/decline/:token` (frontend page validates token via `GET /api/guest/decline/:token`).
4. Guest optionally enters a reason and submits (`POST /api/guest/decline/:token`).
5. Backend marks the registration:
   - `status = "cancelled"`
   - `migrationStatus = "declined"`
   - Sets `declinedAt` timestamp and optional `declineReason` (trimmed, max 500 chars)
6. Organizer notification email is sent (non-blocking) via `EmailService.sendGuestDeclineNotification` (includes guest name, role, event title, optional reason).
7. Duplicate submissions return HTTP 409 with message `Invitation already declined or cancelled`.

## Token Details

- File: `backend/src/utils/guestInvitationDeclineToken.ts`
- Payload: `{ registrationId, type: "guestInvitationDecline", exp }`
- Expiry: 14 days by default (`GUEST_INVITATION_DECLINE_SECRET` fallback to `JWT_SECRET`).
- Validation responses:
  - 400 invalid / wrong type
  - 410 expired

## API Endpoints

| Method | Path                        | Purpose                                                   |
| ------ | --------------------------- | --------------------------------------------------------- |
| GET    | `/api/guest/decline/:token` | Validate token & return summary (event title, role, date) |
| POST   | `/api/guest/decline/:token` | Submit decline + optional reason                          |

### GET Success Shape

```
{
  success: true,
  data: {
    registrationId: string,
    eventTitle: string,
    roleName: string,
    guestName: string,
    eventDate: string | Date,
    location?: string
  }
}
```

### POST Success Shape

```
{
  success: true,
  message: "Invitation declined successfully",
  data: {
    registrationId: string,
    declinedAt: string
  }
}
```

## Frontend

- Page: `frontend/src/pages/GuestDecline.tsx`
- Route: `/guest/decline/:token`
- Optional reason textarea (max 500 chars; empty allowed)
- Success state confirms organizer notification.

## Model Fields Added (GuestRegistration)

- `declineReason?: string` (max 500)
- `declinedAt?: Date`

## Email Changes

- `sendGuestConfirmationEmail` injects a decline section when `declineToken` present.
- `sendGuestDeclineNotification` emails organizer list with optional reason.

## Edge Cases

- Already declined / cancelled -> 409
- Expired token -> 410 (frontend displays generic expired message)
- Invalid token -> 400

## Monitoring & Maintenance

- Replays naturally rejected (status check).
- No TTL index added; storage impact minimal.

## Future Enhancements (Optional)

- Add audit log entries for declines.
- Surface decline analytics (count / reasons) in organizer dashboard.
- Localize email + page copy.
