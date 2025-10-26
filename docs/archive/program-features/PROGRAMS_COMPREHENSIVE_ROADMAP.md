# Programs Feature — API Reference & Architecture

**Feature Status**: ✅ Production Ready  
**Last Updated**: 2025-10-08

This document provides API reference and architecture documentation for the Programs feature in the @Cloud sign-up system.

---

## Overview

Programs serve as containers for related events, enabling:

- Mentor assignment by program/circle (EMBA Mentor Circles)
- Pricing management for program-level ticket discounts
- Event-program relationships with bidirectional linking
- Program-wide analytics and management

**Supported Program Types**:

- EMBA Mentor Circles (with circle-specific mentors: E, M, B, A)
- Effective Communication Workshops

---

## Architecture

### Data Models

#### Program Model

```typescript
interface Program {
  _id: string;
  title: string;
  programType:
    | "EMBA Mentor Circles"
    | "Effective Communication Workshops"
    | "Marketplace Church Incubator Program (MCIP)";
  period: {
    startYear: number;
    startMonth: number; // 1-12
    endYear: number;
    endMonth: number; // 1-12
  };
  introduction?: string;
  flyerUrl?: string;

  // Pricing
  fullPriceTicket: number; // 0-100000 (cents, $0-$1000)
  classRepDiscount?: number; // 0-100000, default 0
  earlyBirdDiscount?: number; // 0-100000, default 0

  // Mentors
  mentors?: UserRefLite[]; // For Communication Workshops
  mentorsByCircle?: {
    // For EMBA Mentor Circles
    E: UserRefLite[];
    M: UserRefLite[];
    B: UserRefLite[];
    A: UserRefLite[];
  };

  // Relationships
  events: string[]; // Event IDs

  createdAt: Date;
  updatedAt: Date;
}
```

#### UserRefLite (Embedded)

```typescript
interface UserRefLite {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string;
}
```

#### Event Extensions

```typescript
interface Event {
  // ... existing fields
  programId?: string | null; // Reference to Program
  mentorCircle?: "E" | "M" | "B" | "A" | null; // For Mentor Circle events
  mentors?: UserRefLite[]; // Snapshotted from program
}
```

### Database Indexes

- `Program.programType` — For filtering by type
- `Event.programId` — For efficient program-event queries

---

## API Endpoints

### Program Management

#### List Programs

```
GET /api/programs
```

**Authorization**: All authenticated users  
**Query Parameters**:

- `type` (string) — Filter by `programType`
- `q` (string) — Search by title

**Response**:

```json
{
  "success": true,
  "data": [
    {
      "id": "prog123",
      "title": "EMBA 2024-2025",
      "programType": "EMBA Mentor Circles",
      "period": {
        "startYear": 2024,
        "startMonth": 9,
        "endYear": 2025,
        "endMonth": 6
      },
      "fullPriceTicket": 500,
      "classRepDiscount": 50,
      "earlyBirdDiscount": 100,
      "events": ["evt1", "evt2"]
    }
  ]
}
```

---

#### Get Program Details

```
GET /api/programs/:id
```

**Authorization**: All authenticated users

**Response**:

```json
{
  "success": true,
  "data": {
    "id": "prog123",
    "title": "EMBA 2024-2025",
    "programType": "EMBA Mentor Circles",
    "introduction": "Year-long mentorship program...",
    "flyerUrl": "https://...",
    "mentorsByCircle": {
      "E": [
        {
          "_id": "user1",
          "firstName": "John",
          "lastName": "Doe",
          "email": "john@example.com"
        }
      ],
      "M": [...],
      "B": [...],
      "A": [...]
    },
    "events": ["evt1", "evt2", "evt3"]
  }
}
```

---

#### List Program Events (Paginated)

```
GET /api/programs/:id/events
```

**Authorization**: All authenticated users

**Query Parameters**:

- `page` (number) — Page number (default: 1)
- `limit` (number) — Items per page (default: 20, max: 100)
- `sort` (string) — Format: `field:dir` (e.g., `date:asc`)
- `type` (string) — Filter by event type
- `status` (string) — Filter by event status

**Response**:

```json
{
  "items": [...],
  "page": 1,
  "limit": 20,
  "total": 125,
  "totalPages": 7,
  "sort": {
    "field": "date",
    "dir": "asc"
  },
  "filters": {
    "type": "Workshop"
  }
}
```

**Notes**:

- Server-side pagination controlled by `VITE_PROGRAM_EVENTS_PAGINATION` feature flag
- Client-side fallback available for offline/error scenarios

---

#### Create Program

```
POST /api/programs
```

**Authorization**: Admin only

**Body**:

```json
{
  "title": "EMBA 2024-2025",
  "programType": "EMBA Mentor Circles",
  "period": {
    "startYear": 2024,
    "startMonth": 9,
    "endYear": 2025,
    "endMonth": 6
  },
  "introduction": "Year-long mentorship...",
  "flyerUrl": "https://...",
  "fullPriceTicket": 500,
  "classRepDiscount": 50,
  "earlyBirdDiscount": 100,
  "mentorsByCircle": {
    "E": [{"_id": "user1", "firstName": "John", ...}],
    "M": [...],
    "B": [...],
    "A": [...]
  }
}
```

**Validation**:

- `title` required
- `programType` must be valid enum value
- `period` months must be 1-12
- Pricing values must be 0-100000 (cents, $0-$1000)
- `classRepDiscount + earlyBirdDiscount` cannot exceed `fullPriceTicket`
- Mentor structure must match program type:
  - EMBA Mentor Circles → `mentorsByCircle` required
  - Communication Workshops → `mentors` array

**Response**:

```json
{
  "success": true,
  "data": {
    "id": "prog123",
    ...
  }
}
```

---

#### Update Program

```
PUT /api/programs/:id
```

**Authorization**: Admin only

**Body**: Same as create, all fields optional

**Behavior**:

- Only provided fields are updated
- Pricing validation enforced
- Mentor structure must match program type if provided

**Response**:

```json
{
  "success": true,
  "data": {...}
}
```

---

#### Delete Program

```
DELETE /api/programs/:id
```

**Authorization**: Admin only

**Response**:

```json
{
  "success": true
}
```

**Notes**:

- Cascade behavior: Events with `programId` are updated to remove reference
- Program deletion does NOT delete events

---

### Event-Program Integration

#### Create Event with Program

```
POST /api/events
```

**Body Extensions**:

```json
{
  // ... standard event fields
  "programId": "prog123",
  "mentorCircle": "E" // Only for Mentor Circle events
}
```

**Behavior**:

1. Validates `programId` exists
2. If `mentorCircle` provided, snapshots mentors from `Program.mentorsByCircle[circle]`
3. Adds event ID to `Program.events` array

**Response**:

```json
{
  "success": true,
  "data": {
    "event": {
      ...
      "programId": "prog123",
      "mentorCircle": "E",
      "mentors": [
        {
          "_id": "user1",
          "firstName": "John",
          "lastName": "Doe",
          "email": "john@example.com"
        }
      ]
    }
  }
}
```

---

#### Update Event Program

```
PUT /api/events/:id
```

**Body**:

```json
{
  "programId": "newProg123",
  "mentorCircle": "M"
}
```

**Behavior**:

- If `programId` changes:
  1. Removes event ID from old program's `events` array
  2. Adds event ID to new program's `events` array
- If `mentorCircle` changes, re-snapshots mentors from new circle
- If `programId` set to `null`, removes program association

---

## Business Rules

### Pricing Validation

1. **Range Limits**:

   - `fullPriceTicket`: 0-100000 (cents, $0-$1000)
   - `classRepDiscount`: 0-100000
   - `earlyBirdDiscount`: 0-100000

2. **Combined Discount Rule**:

   - `classRepDiscount + earlyBirdDiscount <= fullPriceTicket`
   - Prevents negative final prices

3. **Computed Examples** (Display Only):
   - Standard: `fullPriceTicket`
   - Class Rep: `fullPriceTicket - classRepDiscount`
   - Early Bird: `fullPriceTicket - earlyBirdDiscount`
   - Combined: `fullPriceTicket - classRepDiscount - earlyBirdDiscount`

### Mentor Snapshots

**Purpose**: Preserve historical mentor assignments even if program mentors change

**Behavior**:

- Mentors are **copied** from program to event at creation time
- Event mentor data is **immutable** after creation
- Program mentor updates do NOT affect existing events
- New events get current program mentors

**Data Structure**:

```typescript
Event.mentors = Program.mentorsByCircle[Event.mentorCircle]; // At creation time
```

### Event-Program Bidirectional Linking

**On Event Create**:

1. Validate `programId` exists
2. Add event `_id` to `Program.events[]`
3. Snapshot mentors if applicable

**On Event Update**:

1. If `programId` changed:
   - Remove from old program's `events[]`
   - Add to new program's `events[]`
2. If `mentorCircle` changed:
   - Re-snapshot mentors from new circle

**On Event Delete**:

1. Remove event `_id` from `Program.events[]`

**On Program Delete**:

1. Set `programId = null` for all linked events
2. Preserve event mentor snapshots

---

## Frontend Integration

### Program Management UI

**Pages**:

- `/programs` — Grid view with create button (Admin only)
- `/programs/:id` — Detail page with events list and pricing panel
- `/programs/create` — Creation form with validation

**Features**:

- Real-time form validation with `ValidationIndicator`
- Mentor selection by circle (EMBA) or general (Workshops)
- Pricing calculator with live examples
- Event status badges (Upcoming/Ongoing/Past)

### Event Creation Integration

**Form Extensions**:

- Program dropdown (populated from `/api/programs`)
- Mentor circle selector (conditional on program type)
- Mentor preview (from selected circle)

**Validation**:

- Program selection optional
- Mentor circle required if program type is EMBA Mentor Circles

---

## Feature Flags

### VITE_PROGRAM_EVENTS_PAGINATION

**Values**: `server` | `client`  
**Default**: `client`

**Behavior**:

- `server`: Use `/api/programs/:id/events` paginated endpoint
- `client`: Fetch all events, paginate in browser

**Use Cases**:

- Large programs (>100 events) benefit from server pagination
- Offline scenarios use client pagination
- A/B testing performance impact

---

## Error Codes

| Code | Error                  | Description                               |
| ---- | ---------------------- | ----------------------------------------- |
| 400  | `INVALID_PROGRAM_TYPE` | Program type not recognized               |
| 400  | `INVALID_PRICING`      | Pricing violates validation rules         |
| 400  | `MISSING_MENTORS`      | Mentor structure missing for program type |
| 403  | `UNAUTHORIZED`         | Non-admin attempted program mutation      |
| 404  | `PROGRAM_NOT_FOUND`    | Invalid program ID                        |
| 422  | `INVALID_PERIOD`       | Period months out of range (1-12)         |

---

## Testing

### Test Coverage

- **Backend**: 303/303 tests passing
  - Unit: Models, controllers, services (173 tests)
  - Integration: API endpoints, auth, real-time (130 tests)
- **Frontend**: 390/392 tests passing
  - Component: Forms, validation, pagination
  - Integration: Program CRUD, event linking

### Key Test Scenarios

1. **Program CRUD**:

   - Create with valid/invalid data
   - Update pricing with combined discount edge cases
   - Delete with event cascade behavior

2. **Event-Program Linking**:

   - Create event with program ID
   - Update event to different program
   - Verify bidirectional sync

3. **Mentor Snapshots**:

   - Verify snapshot at event creation
   - Confirm immutability after creation
   - Validate circle-specific mentor selection

4. **Pagination**:
   - Server vs client mode switching
   - Sort and filter combinations
   - Edge cases (empty results, single page)

---

## Performance Considerations

### Database Optimization

- **Indexes**:

  - `Program.programType` — Filter queries
  - `Event.programId` — Join queries
  - `Program.period.{startYear,endYear}` — Date range queries

- **Denormalization**:
  - `Program.events[]` array for O(1) program→events lookup
  - Mentor snapshots avoid N+1 queries on event display

### API Performance

- **Server Pagination**:

  - Reduces payload size for large programs
  - Limit: 100 items per page
  - Recommended for programs with >50 events

- **Caching Opportunities**:
  - Program details (low mutation rate)
  - Mentor lists (relatively static)

---

## Security

### Authorization

- **Read**: All authenticated users can view programs and events
- **Write**: Only Admins can create/update/delete programs
- **Mentor Data**: Only name, email, avatar exposed (no phone/sensitive fields)

### Validation

- **Input Sanitization**: All string fields sanitized
- **Range Checks**: Pricing values enforced at API layer
- **Business Rules**: Combined discount validation prevents negative prices

---

## Notes

- **Mentor Snapshots vs Real-time**: Current design prioritizes historical accuracy; future enhancement could add "sync mentors" action
- **Pricing Panel Visibility**: Controlled by existence of `program.pricing` data; no separate feature flag
- **Calendar Integration**: Future enhancement for mentor availability scheduling

---

**Related Documentation**:

- `PROGRAM_DELETION_ROADMAP.md` — Program deletion API specification
- `TERMINOLOGY.md` — Program type definitions and naming conventions
