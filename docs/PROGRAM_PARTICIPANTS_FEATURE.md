# Program Participants Feature

## Overview

This feature adds **Mentees** and **Class Representatives** sections to the Program Detail page, displaying all enrolled participants including both paid users and admin enrollments.

## Features

### 1. Mentees Section

- Displays all users who purchased the program without selecting the Class Rep option
- Shows admin enrollments (Super Admin & Administrator who enrolled for free)
- Sorted by enrollment date (paid users first, then admin enrollments)

### 2. Class Representatives Section

- Displays all users who purchased the program with the Class Rep option
- Shows admin enrollments for Class Reps
- Sorted by enrollment date

### 3. Admin Enrollment

- **Who**: Super Admin and Administrator only
- **Benefits**: Free enrollment without payment
- **Options**: Can enroll as either Mentee OR Class Rep (not both simultaneously)
- **UI**: Shows enrollment buttons when not enrolled, and unenroll button when enrolled
- **Workflow**:
  1. Admin sees both enrollment options when not enrolled
  2. After enrolling, only the unenroll button is shown
  3. To switch types, must unenroll first, then re-enroll

### 4. Contact Information Visibility

- **Who can view**:
  - Super Admin
  - Administrator
  - Mentors of the program
- **What's shown**:
  - Email (clickable mailto link)
  - Phone (if provided)
- **Who cannot view**:
  - Regular participants
  - Guest users

### 5. Visual Indicators

- **Admin Badge**: Admin enrollments show a blue "Admin" badge
- **Empty State**: Shows message when no participants enrolled yet

## Technical Implementation

### Backend

#### API Endpoints

```
GET    /api/programs/:id/participants     - Get all mentees and class reps
POST   /api/programs/:id/admin-enroll     - Admin enrollment
DELETE /api/programs/:id/admin-enroll     - Admin unenrollment
```

#### Database Schema

```typescript
// Program model
{
  adminEnrollments: {
    mentees: ObjectId[],      // Admin users enrolled as mentees
    classReps: ObjectId[]     // Admin users enrolled as class reps
  }
}
```

#### Data Sources

- **Paid Enrollments**: Query `Purchase` collection (status: 'completed')
  - Filter by `isClassRep` field to separate mentees from class reps
- **Admin Enrollments**: Stored directly in `Program.adminEnrollments`

### Frontend

#### Components

- `ProgramParticipants` - Main container component
- `AdminEnrollmentPrompt` - Shows enrollment options for admins
- `UserCard` - Displays individual participant info

#### Props & State Management

```typescript
<ProgramParticipants
  programId={string}
  program={
    id: string,
    mentors: { userId: string }[]
  }
/>
```

## User Experience

### For Super Admin / Administrator

1. **Not Enrolled**: See enrollment prompt with two buttons
2. **Enrolled as Mentee**: See "Unenroll from Mentees" button in Mentees section
3. **Enrolled as Class Rep**: See "Unenroll from Class Representatives" button in Class Reps section
4. **Can view**: All participant contact information

### For Mentors

1. **Can view**: All participant contact information
2. **Cannot**: Enroll for free (must pay like regular users)

### For Regular Users

1. **Can view**: Participant names and avatars only
2. **Cannot view**: Contact information (email/phone)
3. **Cannot**: Enroll for free

## Security & Authorization

### Enrollment Authorization

- Only Super Admin and Administrator can use admin enrollment endpoints
- Verified in `ProgramController.adminEnroll` and `adminUnenroll`

### Contact Info Authorization

- Frontend checks: `isAdmin || isMentor`
- Backend should also enforce (if contact info endpoint is added)

### Audit Logging

- All admin enrollments/unenrollments are logged to `AuditLog`
- Includes: action, actor, program details, timestamp

## Testing

### Backend Tests Needed

- [ ] GET /api/programs/:id/participants
  - Returns correct mentees and class reps
  - Combines paid purchases and admin enrollments
  - Sorted by enrollment date
- [ ] POST /api/programs/:id/admin-enroll
  - Only allows Super Admin/Administrator
  - Prevents duplicate enrollment
  - Requires unenroll before re-enrolling as different type
- [ ] DELETE /api/programs/:id/admin-enroll
  - Removes user from correct list
  - Only allows enrolled users to unenroll

### Frontend Tests Needed

- [ ] ProgramParticipants component
  - Renders mentees and class reps correctly
  - Shows admin enrollment prompt when appropriate
  - Shows/hides contact info based on user role
  - Handles enrollment/unenrollment successfully
- [ ] Integration with ProgramDetail page
  - Sections appear after mentors section
  - Updates when new enrollments occur

## Future Enhancements

1. **Real-time Updates**: Use WebSocket to update participant lists when new enrollments occur
2. **Search/Filter**: Add search for participants by name
3. **Export**: Allow exporting participant lists to CSV
4. **Bulk Actions**: Admin operations on multiple participants
5. **Participant Stats**: Show enrollment trends and statistics
6. **Notifications**: Notify mentors when new participants enroll

## Related Documentation

- [Purchase Model](../backend/src/models/Purchase.ts)
- [Program Model](../backend/src/models/Program.ts)
- [ProgramController](../backend/src/controllers/programController.ts)
- [API Service](../frontend/src/services/api.ts)
