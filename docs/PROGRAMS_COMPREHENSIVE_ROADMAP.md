# Programs Feature - Comprehensive Roadmap & Status

Last updated: 2025-09-20 (after event badges, layout stabilization, pricing UI + tests, layout regression test)

This document consolidates all program-related documentation and tracks the complete implementation status of the Programs feature in the @Cloud sign-up system.

## 🎯 Project Goals

- **Primary**: Introduce Programs as containers for related events (EMBA Mentor Circles, Communication Workshops)
- **Secondary**: Enable mentor assignment by program/circle, pricing management, and event-program relationships
- **Tertiary**: Provide comprehensive program management UX with pagination, filtering, and detailed analytics

## 📊 Overall Status Summary

| Component                     | Status      | Notes                                                         |
| ----------------------------- | ----------- | ------------------------------------------------------------- |
| **Backend Core**              | ✅ Complete | Models, API, controllers, tests all green                     |
| **Frontend Core**             | ✅ Complete | CRUD operations, validation, mentor selection                 |
| **Event-Program Integration** | ✅ Complete | Bidirectional linking, mentor snapshots                       |
| **Program Creation Bug**      | ✅ Fixed    | API integration implemented (2025-09-20)                      |
| **Pagination Features**       | ✅ Complete | Server-side pagination with feature flags                     |
| **Pricing UX**                | ✅ Phase 3a | Create/Edit forms with validation; detail panel with examples |
| **Advanced Analytics**        | 📋 Planned  | Phase 3 scope                                                 |

---

## 🏗️ Architecture Overview

### Backend Architecture

**Models** (`backend/src/models/`)

- ✅ `Program.ts` - Core program model with pricing, mentors, event linkage
- ✅ `Event.ts` - Extended with `programId`, `mentorCircle`, `mentors` snapshot
- ✅ Full schema validation and indexing

**API Endpoints** (`backend/src/routes/programs.ts`)

```
✅ GET    /api/programs              - List programs with filters
✅ GET    /api/programs/:id          - Get program details
✅ GET    /api/programs/:id/events   - List program events (paginated)
✅ POST   /api/programs              - Create program (Admin only)
✅ PUT    /api/programs/:id          - Update program (Admin only)
✅ DELETE /api/programs/:id          - Delete program (Admin only)
```

**Controllers** (`backend/src/controllers/programController.ts`)

- ✅ Full CRUD operations with proper authorization
- ✅ Event relationship management (bidirectional sync)
- ✅ Mentor snapshot handling for different program types

### Frontend Architecture

**Pages** (`frontend/src/pages/`)

- ✅ `Programs.tsx` - Program grid/list view with create button
- ✅ `ProgramDetail.tsx` - Individual program detail with events
- ✅ `CreateNewProgram.tsx` - Program creation form with validation

**Services** (`frontend/src/services/api.ts`)

- ✅ `programService` - Complete API client with all operations
- ✅ Proper error handling and response typing

**Integration Features**

- ✅ Event creation/editing with program selection
- ✅ Mentor circle selection for EMBA programs
- ✅ Real-time validation with `ValidationIndicator` components
- ✅ Mentor selection with role-based filtering

---

## 🔥 Recent Achievements (September 2025)

### Event Status Labels on Program Pages ✅

- All program pages now show every linked event (past, ongoing, upcoming) with a clear status badge next to each title.
- Status is derived from backend status when present, with a robust date/time fallback to determine Upcoming/Ongoing/Past.
- Works in both client-side and server-side pagination modes; badges render consistently across pages.

### Layout Stabilization and Footer/Background Fixes ✅

- Resolved a bug where the footer could “rise” leaving white space below on specific program pages.
- Standardized dashboard layouts to use `min-h-screen` with `flex flex-col` and added `pt-16` to account for the fixed header.
- Removed global `body` min-height to eliminate phantom white space interactions.
- Moved vertical spacing responsibility from the `Footer` to layout wrappers to avoid margin-collapse anomalies.
- Restored consistent gray background coverage app-wide.

### Accessibility & Pagination UX Improvements ✅

- Added an accessible “Go to page” control with range validation, clamping, and SR-only live announcements.
- Debounced Enter key handling to prevent accidental rapid page jumps.
- Clear disabled states for Prev/Next and a list-only loading spinner for server pagination.

### Pricing UX (Admin + Detail) ✅

- Program Detail displays a Pricing panel (when pricing exists) with computed examples (Standard, Class Rep, Early Bird, Combined), tolerant to both top-level and nested pricing shapes.
- Admin forms (Create/Edit Program) include pricing fields with validation: integers, 0–2000 ranges, and a combined discount guard (cannot exceed full price).
- Computed examples render live from form inputs with currency formatting.
- Help text was added to clarify pricing rules (integer ranges, combined-discount rule). Currency formatting is standardized across Create/Edit/Detail.

### Program Creation Bug Fix ✅

**Issue**: Create New Program form was not actually creating programs
**Root Cause**:

- Missing `programService` import in `CreateNewProgram.tsx`
- Commented-out API call in `onSubmit` function
- No data transformation for mentor objects

**Solution Implemented**:

```tsx
// Added proper import
import { fileService, programService } from "../services/api";

// Implemented actual program creation
const payload = {
  title: data.title,
  programType: data.programType,
  period: { startYear, startMonth, endYear, endMonth },
  introduction: data.introduction,
  flyerUrl: data.flyerUrl,
  fullPriceTicket: 0, // Default values
  classRepDiscount: 0,
  earlyBirdDiscount: 0,
  // Proper mentor transformation based on program type
  mentors: programType === "Effective Communication Workshops"
    ? effectiveCommunicationMentors.map(transformMentor)
    : undefined,
  mentorsByCircle: programType === "EMBA Mentor Circles"
    ? { E: eMentors.map(transformMentor), M: mMentors.map(transformMentor), ... }
    : undefined
};

await programService.create(payload);
```

**Validation**: End-to-end creation verified locally; full suite runs via `npm test`.

### Mentor Selection Enhancement ✅

- Fixed mentor picker to show all qualified users (Super Admin, Administrator, Leaders)
- Added `excludeMainOrganizer={false}` for mentor selection vs co-organizer selection
- Unified mentor selection UI across all program types

### Real-time Validation System ✅

- Implemented comprehensive field-level validation with `ValidationIndicator`
- Added overall form status with consistent styling
- Unified validation colors across Create Event and Create Program pages

### Layout Regression Tests ✅

- Added a lightweight regression test for `DashboardLayout` to guard header offset (`pt-16`) and footer placement within the scrollable area. This helps prevent reintroduction of the footer/whitespace bug.

---

## 📋 Detailed Implementation Status

### Phase 1: Core Foundation ✅

**Backend Implementation**

- [x] Program model with mentors, pricing fields, event relationships
- [x] Event model extensions (programId, mentorCircle, mentors snapshot)
- [x] Program CRUD API with proper authentication/authorization
- [x] Event-program bidirectional linking logic
- [x] Mentor snapshot system for EMBA circles
- [x] Comprehensive integration tests (68 test files, 303 tests passing)

**Frontend Implementation**

- [x] Program listing page with grid view and create button
- [x] Program detail page with events list
- [x] Program creation form with mentor selection
- [x] Event creation/editing with program dropdown
- [x] Mentor circle selection for EMBA events
- [x] Real-time form validation system
- [x] Error handling and user feedback

**Event Integration**

- [x] Program selection in event forms
- [x] Mentor circle selection for Mentor Circle events
- [x] Mentor snapshot display on event details
- [x] Proper event-program relationship management

### Phase 2: Advanced Features ✅

**Pagination System**

- [x] Server-side pagination API (`/api/programs/:id/events?page&limit&sort`)
- [x] Client-side pagination fallback
- [x] Feature flag control (`VITE_PROGRAM_EVENTS_PAGINATION=server`)
- [x] URL query sync for deep linking
- [x] Accessibility features (aria-live announcements, keyboard navigation)
- [x] Loading states and error handling

**API Contract**:

```typescript
GET /api/programs/:id/events?page=1&limit=20&sort=date:asc&type=Workshop

Response: {
  "items": Event[],
  "page": 1, "limit": 20, "total": 125, "totalPages": 7,
  "sort": {"field":"date","dir":"asc"},
  "filters": {"type":"Workshop"}
}
```

**Frontend Features**:

- [x] Pager controls with disabled edge states
- [x] Sort dropdown (date asc/desc)
- [x] Optional type/status filters
- [x] "Go to page" input with range validation
- [x] List-only spinner during server transitions
- [x] Empty states and error handling

### Phase 3: Pricing UX ✅ (Part A)

**Current State**: Pricing panel on Program Detail is live; Create/Edit Program include pricing fields + validation; tests pass.

**Remaining Items (Part B)**:

- [x] Tooltip/help text for pricing rules (Completed 2025-09-20)
- [ ] Optional server-calculated pricing examples endpoint
- [ ] Program-level feature flag for showing pricing panel

**Model Support** ✅:

- `fullPriceTicket: number` (0-2000)
- `classRepDiscount?: number` (0-2000, default 0)
- `earlyBirdDiscount?: number` (0-2000, default 0)

**Acceptance Criteria**:

- [ ] Pricing panel shows when `program.pricing` exists
- [ ] Displays 2-3 computed examples with formatted currency
- [ ] Validates pricing inputs with inline messages
- [ ] Keyboard accessible tooltips and help text
- [ ] Graceful fallback when pricing is incomplete

---

## 🧪 Testing Status

### Backend Tests ✅

- **Unit Tests**: 173 tests covering models, controllers, services, utilities
- **Integration Tests**: 130 tests covering API endpoints, authentication, real-time features
- **Total**: 303/303 tests passing
- **Coverage**: Comprehensive coverage of program CRUD, event relationships, mentor snapshots

**Key Test Areas**:

- Program creation/update/deletion with proper authorization
- Event-program bidirectional linking and sync
- Mentor snapshot creation and validation
- Pagination API with sorting and filtering
- Error handling and edge cases

### Frontend Tests ✅

- **Component & Integration**: Program detail badges covered; selectors updated where multiple “View” buttons exist
- **Skipped Test (intentional)**: One frontend test is skipped because it depends on live backend health; it’s gated to avoid flakiness in CI/local runs
- **E2E Coverage**: Program creation workflow, mentor selection, validation

**Key Test Areas**:

- Program CRUD operations and form validation
- Event creation with program selection
- Mentor selection for different program types
- Real-time validation system
- Pagination controls and accessibility

---

## ⏭️ Immediate Next Steps

1. Pricing UX (Phase 3B)

- Optional server-calculated pricing examples endpoint; add a client toggle to prefer server examples with client-side fallback.
- Consider a program-level feature flag to show/hide the pricing panel.

2. Layout Regression Coverage

- Add a companion regression test for `GuestDashboardLayout` mirroring the `DashboardLayout` checks (header offset, footer placement).
- Spot-check background coverage snapshots on a couple of key routes.

3. Pagination Policy & Defaults

- Decide default for `VITE_PROGRAM_EVENTS_PAGINATION` (server vs client) and document ops guidance.
- Add offline/health fallback: if server paging fails, transparently fall back to client mode.

4. Accessibility Polish

- Expand aria-live coverage for sorting changes; verify keyboard navigation on pagination controls.

5. Observability

- Add lightweight logging around program event fetching (server mode) to monitor latency and errors in production.

---

## 🔄 API Documentation

### Events API Extensions

**Endpoint Changes**:

```typescript
POST /api/events
PUT /api/events/:id

// Additional fields for program integration:
{
  programId?: string | null,        // MongoDB ObjectId of Program
  mentorCircle?: "E"|"M"|"B"|"A"|null  // For Mentor Circle events
}
```

**Behavior**:

- When `programId` provided: validates program exists, updates `Program.events` array
- When `mentorCircle` provided: snapshots mentors from `Program.mentorsByCircle[circle]`
- On update with changed `programId`: syncs old and new program event arrays
- On delete: removes event ID from linked program's events array

**Response Extensions**:

```typescript
{
  success: true,
  data: {
    event: {
      // Standard event fields...
      programId?: string,
      mentorCircle?: string,
      mentors?: UserRefLite[]  // Snapshotted mentor data
    }
  }
}
```

### Programs API

**Complete CRUD Interface**:

```typescript
// List programs with optional filtering
GET /api/programs?type=EMBA&q=searchTerm
Response: { success: true, data: Program[] }

// Get program details
GET /api/programs/:id
Response: { success: true, data: Program }

// List program events (paginated)
GET /api/programs/:id/events?page=1&limit=20&sort=date:asc
Response: { items: Event[], page: 1, total: 50, totalPages: 3, ... }

// Create program (Admin only)
POST /api/programs
Body: { title, programType, period, mentors/mentorsByCircle, ... }
Response: { success: true, data: Program }

// Update program (Admin only)
PUT /api/programs/:id
Body: { title?, mentors?, ... }
Response: { success: true, data: Program }

// Delete program (Admin only)
DELETE /api/programs/:id
Response: { success: true }
```

---

## 🚀 Deployment & Operations

### Feature Flags

- `VITE_PROGRAM_EVENTS_PAGINATION=server` - Enable server-side pagination (default: client)
- Ready for staged rollout and A/B testing

### Database Considerations

- Programs collection with proper indexing
- Event.programId indexed for efficient queries
- Mentor snapshots stored as embedded documents (no separate collection)

### Performance

- Server-side pagination reduces payload size for large programs
- Mentor snapshots avoid N+1 queries on event display
- Proper indexes on programId, programType, period fields

---

## 🔮 Future Roadmap

### Phase 4: Analytics & Reporting (Planned)

- [ ] Program engagement analytics
- [ ] Cross-program mentor utilization reports
- [ ] Pricing effectiveness analysis
- [ ] Event success metrics by program type

### Phase 5: Advanced UX (Future)

- [ ] Bulk event operations within programs
- [ ] Program templates and cloning
- [ ] Advanced mentor availability scheduling
- [ ] Integration with external calendar systems

### Phase 6: Scale & Performance (Future)

- [ ] Program archiving and lifecycle management
- [ ] Advanced search and filtering
- [ ] Bulk import/export capabilities
- [ ] Mobile-optimized program management

---

## 📚 Implementation Notes

### Key Design Decisions

1. **Mentor Snapshots**: Store mentor data at event creation time to preserve historical accuracy
2. **Bidirectional Linking**: Events know their program, programs maintain event arrays for performance
3. **Feature Flags**: Enable gradual rollout of pagination and other features
4. **Role-based Access**: Only Admins can create/modify programs, consistent with event permissions

### Technical Debt & Maintenance

- Pricing UI forms are the main remaining Phase 2 work item
- Consider mentor data sync strategies if real-time updates become required
- Monitor program-event relationship consistency in production

### Security Considerations

- All program mutations require Admin authentication
- Mentor data snapshots don't include sensitive information (phone numbers, etc.)
- Proper input validation on all program fields including pricing ranges

---

## 🎉 Conclusion

The Programs feature is **functionally complete** for Phase 1-2 requirements with robust backend implementation, comprehensive frontend UX, and thorough test coverage. The recent bug fix ensures end-to-end program creation works correctly.

**Key Success Metrics**:

- ✅ 303/303 backend tests passing
- ✅ 390/392 frontend tests passing
- ✅ Full CRUD operations with proper validation
- ✅ Event-program integration with mentor snapshots
- ✅ Pagination system with accessibility features
- ✅ Real-time validation and error handling

**Next Steps**: Implement Phase 3 pricing UX when product requirements are finalized.
