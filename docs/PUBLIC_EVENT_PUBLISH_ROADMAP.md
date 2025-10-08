# Public Event Publish & Share — API Reference

**Feature Status**: ✅ Live in Production  
**Last Updated**: 2025-10-08

This document provides API reference and data model documentation for the public event publishing feature.

---

## Overview

The public event publishing feature allows organizers to:

- Publish events to a public, unauthenticated page
- Control which roles are open to public registration
- Generate short links for easy sharing
- Support both guest and user registrations without login

---

## Data Models

### Event Model Extensions

```typescript
interface Event {
  // ... existing fields
  publish: boolean; // Default: false
  publishedAt: Date | null; // Set on first publish
  publicSlug: string; // URL-safe, unique identifier
  roles: Array<{
    // ... existing role fields
    openToPublic: boolean; // Default: false
  }>;
}
```

### ShortLink Collection

```typescript
interface ShortLink {
  key: string; // 6-8 char base62, unique
  targetUrl: string; // e.g., "/p/:slug"
  eventId: string; // For lifecycle management
  createdBy: string; // userId
  createdAt: Date;
  expiresAt?: Date; // Set on unpublish or event end
}
```

### Indexes

- `Event.publicSlug` — unique
- `ShortLink.key` — unique

---

## URL Scheme

| Type         | Pattern    | Example                   | Notes                      |
| ------------ | ---------- | ------------------------- | -------------------------- |
| Public Event | `/p/:slug` | `/p/mentor-circle-abc123` | Canonical URL              |
| Short Link   | `/s/:key`  | `/s/7fzKq`                | 302 redirect to `/p/:slug` |

---

## API Endpoints

### Publishing Lifecycle

#### Publish Event

```
POST /api/events/:eventId/publish
```

**Authorization**: Organizer or Admin  
**Body**: `{}` (optional)

**Requirements**:

- At least one role must have `openToPublic=true`

**Response**:

```json
{
  "success": true,
  "event": {
    "id": "...",
    "publicSlug": "mentor-circle-abc123",
    "publish": true,
    "publishedAt": "2025-10-08T12:00:00Z"
  }
}
```

**Errors**:

- `400` — No public roles available
- `422` — Missing required fields for publishing

---

#### Unpublish Event

```
POST /api/events/:eventId/unpublish
```

**Authorization**: Organizer or Admin

**Effects**:

- Sets `publish=false`
- Expires all related short links (sets `expiresAt=now`)

**Response**:

```json
{
  "success": true,
  "message": "Event unpublished successfully"
}
```

---

### Role Management

#### Update Role Public Status

```
PATCH /api/events/:eventId/roles
```

**Authorization**: Organizer or Admin

**Body**:

```json
{
  "roles": [
    {
      "roleId": "role123",
      "openToPublic": true
    }
  ]
}
```

**Notes**:

- Can update multiple roles at once
- Preserves `openToPublic` when field is omitted

---

### Public Event Access (No Auth Required)

#### Get Public Event

```
GET /api/public/events/:slug
```

**Authorization**: None (public endpoint)

**Response**:

```json
{
  "id": "event123",
  "title": "Mentor Circle — JavaScript",
  "description": "Learn JavaScript fundamentals...",
  "date": "2025-10-15",
  "time": "18:00",
  "timeZone": "America/Los_Angeles",
  "location": "Online",
  "format": "Online",
  "flyerUrl": "https://...",
  "agenda": "Session overview...",
  "roles": [
    {
      "id": "role123",
      "name": "Mentee",
      "description": "Participate in mentoring session",
      "price": 0,
      "capacityRemaining": 5
    }
  ]
}
```

**Sanitization**:

- ✅ Public fields only (title, description, dates, location, roles)
- ❌ No internal notes, emails, or admin data
- ❌ Only roles with `openToPublic=true` are included

---

#### Public Registration

```
POST /api/public/events/:slug/register
```

**Authorization**: None (public endpoint)

**Body**:

```json
{
  "roleId": "role123",
  "guest": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phone": "+1234567890"
  }
}
```

**Validation**:

- Role must have `openToPublic=true`
- Role must have capacity remaining
- Email validation enforced

**Behavior**:

- If email matches existing user → associates registration with that user
- Otherwise → creates guest registration

**Response**:

```json
{
  "success": true,
  "registration": {
    "id": "reg123",
    "roleId": "role123",
    "roleName": "Mentee",
    "status": "registered"
  }
}
```

---

#### List Public Events

```
GET /api/public/events
```

**Authorization**: None (public endpoint)

**Query Parameters**:

- `page` (number) — Page number (default: 1)
- `limit` (number) — Results per page (default: 20, max: 100)

**Response**:

```json
{
  "events": [...],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalEvents": 42,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

### Short Links

#### Get or Create Short Link

```
POST /api/events/:eventId/short-link
```

**Authorization**: Organizer or Admin

**Requirements**:

- Event must be published
- At least one role must have `openToPublic=true`

**Behavior**:

- Idempotent (returns existing link if already created)

**Response**:

```json
{
  "success": true,
  "shortLink": {
    "key": "7fzKq",
    "fullUrl": "https://app.example.com/s/7fzKq",
    "targetUrl": "/p/mentor-circle-abc123",
    "expiresAt": "2025-10-16T00:00:00Z"
  }
}
```

---

#### Redirect Short Link

```
GET /s/:key
```

**Authorization**: None (public endpoint)

**Behavior**:

- `302` redirect to `/p/:slug`
- `410 Gone` if expired
- `404 Not Found` if invalid key

---

## Business Rules

### Publishing Requirements

1. **Necessary Fields**: Events must have format-specific required fields

   - Online: `zoomLink`, `meetingId`, `passcode`
   - In-person: `location`
   - Hybrid: All of the above

2. **Public Roles**: At least one role must have `openToPublic=true`

3. **Auto-unpublish**: Events are automatically unpublished if:
   - Required fields are removed
   - Format changes introduce new missing fields

### Capacity Enforcement

- Enforced per role
- Public registrations count toward capacity limits
- No registrations allowed when capacity is full

### Short Link Lifecycle

- Created on first request (idempotent)
- Expires when:
  - Event is unpublished
  - Event end date passes
- Cannot be regenerated after expiration

---

## Frontend Integration

### Organizer UI

**Event Detail Page** (Management Mode):

- Publish/Unpublish button
- Per-role `openToPublic` toggles
- Short link copy button (when published)
- Public URL display

**Public Events List**:

- Route: `/events/public`
- Shows all published events
- Admin/Leader access only (for preview)

### Public UI

**Public Event Page**:

- Route: `/p/:slug`
- No authentication required
- Registration form for public roles
- Clean, marketing-friendly design

---

## Error Codes

| Code | Error                     | Description                               |
| ---- | ------------------------- | ----------------------------------------- |
| 400  | `NO_PUBLIC_ROLE`          | No role has `openToPublic=true`           |
| 404  | `EVENT_NOT_FOUND`         | Invalid slug or event not published       |
| 410  | `LINK_EXPIRED`            | Short link has expired                    |
| 422  | `MISSING_REQUIRED_FIELDS` | Event missing necessary fields for format |
| 403  | `ROLE_NOT_PUBLIC`         | Attempted to register for non-public role |
| 409  | `CAPACITY_FULL`           | Role has no remaining capacity            |

---

## Notes

- **SEO**: Public event pages are indexable for published events
- **Privacy**: All PII is sanitized from public endpoints
- **Rate Limiting**: Public endpoints have stricter rate limits
- **Audit**: All public registrations are logged for monitoring

---

**Related Documentation**:

- `PUBLISH_VALIDATION_RULES.md` — Required fields per format
- `SHORT_LINKS_API.md` — Detailed short link specifications
- `GUEST_DECLINE_FLOW.md` — Guest invitation decline process
