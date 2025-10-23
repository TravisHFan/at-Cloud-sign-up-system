# ✅ Todo #16 Complete: Create Promo Code Routes & Controller

**Status**: ✅ COMPLETE  
**Completed**: 2025-10-18  
**Files Created**:

- `backend/src/controllers/promoCodeController.ts` (560+ lines)
- `backend/src/routes/promoCodes.ts` (75+ lines)

**Files Modified**:

- `backend/src/routes/index.ts` (added promo code routes)

---

## What Was Done

Created complete REST API endpoints for promo code management with separate routes for **users** (manage their own codes) and **admins** (manage all codes, create staff codes, configure bundle settings).

### Architecture Overview

**Controller**: `PromoCodeController` with 7 methods  
**Routes**: Mounted at `/api/promo-codes`  
**Middleware**: All routes require authentication; admin routes require `requireAdmin`

---

## API Endpoints

### 1. User Endpoints

#### `GET /api/promo-codes/my-codes`

Get current user's promo codes with optional filtering.

**Query Parameters**:

- `status` (optional): `'all'` | `'active'` | `'expired'` | `'used'` (default: `'all'`)

**Response**:

```json
{
  "success": true,
  "codes": [
    {
      "_id": "...",
      "code": "BUNDLE50",
      "type": "bundle_discount",
      "discountAmount": 5000,
      "discountPercent": null,
      "isActive": true,
      "isUsed": false,
      "isExpired": false,
      "isValid": true,
      "expiresAt": "2025-11-18T00:00:00Z",
      "usedAt": null,
      "usedForProgramId": null,
      "excludedProgramId": { "_id": "...", "name": "Advanced Leadership" },
      "allowedProgramIds": [],
      "createdAt": "2025-10-18T10:00:00Z"
    }
  ]
}
```

**Filter Logic**:

- `active`: `isActive=true`, `isUsed=false`, not expired
- `expired`: `expiresAt <= now`, `isUsed=false`
- `used`: `isUsed=true`
- `all`: no filters

---

#### `POST /api/promo-codes/validate`

Validate a promo code for a specific program before checkout.

**Request Body**:

```json
{
  "code": "BUNDLE50",
  "programId": "60d5ec49f1b2c72b8c8e4f1a"
}
```

**Response (Valid)**:

```json
{
  "success": true,
  "valid": true,
  "message": "Promo code is valid.",
  "code": {
    "_id": "...",
    "code": "BUNDLE50",
    "type": "bundle_discount",
    "discountAmount": 5000,
    "discountPercent": null,
    "expiresAt": "2025-11-18T00:00:00Z"
  }
}
```

**Response (Invalid)**:

```json
{
  "success": true,
  "valid": false,
  "message": "This promo code has expired."
}
```

**Validation Checks**:

1. Code exists in database
2. Code is active (`isActive=true`)
3. Code not already used (`isUsed=false`)
4. Code not expired (`expiresAt > now` or `null`)
5. For bundle codes: User owns the code
6. For bundle codes: Not excluded for this program (`excludedProgramId !== programId`)
7. For staff codes: Program is in `allowedProgramIds` (or `allowedProgramIds` is empty)

**Error Messages**:

- `"Invalid promo code."` - Code doesn't exist
- `"This promo code has been deactivated."` - `isActive=false`
- `"This promo code has already been used."` - `isUsed=true`
- `"This promo code has expired."` - `expiresAt <= now`
- `"This bundle code cannot be used for the program you purchased (Program Name)."` - Excluded program
- `"This staff code is not valid for this program."` - Not in allowed programs
- `"This bundle code belongs to another user."` - Ownership check failed

---

### 2. Admin Endpoints

#### `GET /api/promo-codes` (Admin Only)

List all promo codes with filtering, search, and pagination.

**Query Parameters**:

- `type` (optional): `'all'` | `'bundle_discount'` | `'staff_access'` (default: `'all'`)
- `status` (optional): `'all'` | `'active'` | `'expired'` | `'used'` (default: `'all'`)
- `search` (optional): Search by code or owner name/email (case-insensitive regex)
- `page` (optional): Page number (default: `1`)
- `limit` (optional): Results per page (default: `20`, max: `100`)

**Response**:

```json
{
  "success": true,
  "codes": [
    {
      "_id": "...",
      "code": "STAFF100",
      "type": "staff_access",
      "discountAmount": null,
      "discountPercent": 100,
      "ownerId": {
        "_id": "...",
        "username": "john_doe",
        "email": "john@example.com",
        "firstName": "John",
        "lastName": "Doe"
      },
      "isActive": true,
      "isUsed": false,
      "isExpired": false,
      "isValid": true,
      "expiresAt": null,
      "usedAt": null,
      "usedForProgramId": null,
      "excludedProgramId": null,
      "allowedProgramIds": [{ "_id": "...", "name": "Leadership Course" }],
      "createdAt": "2025-10-18T09:00:00Z",
      "createdBy": "admin@atcloud.com"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

**Features**:

- Populates `ownerId`, `usedForProgramId`, `excludedProgramId`, `allowedProgramIds`
- Search queries both code field and user fields (username, email, firstName, lastName)
- Sorted by `createdAt` descending (newest first)

---

#### `POST /api/promo-codes/staff` (Admin Only)

Create a staff access promo code for a user.

**Request Body**:

```json
{
  "userId": "60d5ec49f1b2c72b8c8e4f1a",
  "discountPercent": 100,
  "allowedProgramIds": ["60d5ec49f1b2c72b8c8e4f1b"],
  "expiresAt": "2025-12-31T23:59:59Z"
}
```

**Field Requirements**:

- `userId` (required): Valid MongoDB ObjectId of existing user
- `discountPercent` (required): Number between 0-100
- `allowedProgramIds` (optional): Array of program IDs (empty/null = all programs)
- `expiresAt` (optional): Date in future (ISO 8601 string)

**Response**:

```json
{
  "success": true,
  "message": "Staff promo code created successfully.",
  "code": {
    "_id": "...",
    "code": "ABC12XYZ",
    "type": "staff_access",
    "discountPercent": 100,
    "ownerId": {
      "_id": "...",
      "username": "john_doe",
      "email": "john@example.com",
      "firstName": "John",
      "lastName": "Doe"
    },
    "allowedProgramIds": [{ "_id": "...", "name": "Leadership Course" }],
    "expiresAt": "2025-12-31T23:59:59Z",
    "isActive": true,
    "createdAt": "2025-10-18T10:30:00Z",
    "createdBy": "admin@atcloud.com"
  }
}
```

**Validation**:

- User must exist
- `discountPercent` must be 0-100
- All program IDs must be valid ObjectIds
- `expiresAt` must be in future (if provided)
- Code auto-generated using `PromoCode.generateUniqueCode()` (8-char, excludes confusing chars)

**Error Responses**:

- `400`: Invalid user ID, discount out of range, invalid program IDs, expiry in past
- `404`: User not found

---

#### `GET /api/promo-codes/config` (Admin Only)

Get bundle discount configuration.

**Response**:

```json
{
  "success": true,
  "config": {
    "enabled": true,
    "discountAmount": 5000,
    "expiryDays": 30
  }
}
```

**⚠️ TEMPORARY IMPLEMENTATION**: Currently reads from environment variables:

- `BUNDLE_DISCOUNT_ENABLED` (default: `true`)
- `BUNDLE_DISCOUNT_AMOUNT` (default: `5000` = $50.00)
- `BUNDLE_EXPIRY_DAYS` (default: `30`)

**Todo #17**: Will read from `SystemConfig` model in database instead.

---

#### `PUT /api/promo-codes/config` (Admin Only)

Update bundle discount configuration.

**Request Body**:

```json
{
  "enabled": true,
  "discountAmount": 7500,
  "expiryDays": 60
}
```

**Validation**:

- `enabled`: Must be boolean
- `discountAmount`: Must be 1000-20000 ($10-$200 in cents)
- `expiryDays`: Must be 7-365

**Response (Not Yet Implemented)**:

```json
{
  "success": false,
  "message": "Bundle config update not yet implemented. This requires SystemConfig model (Todo #17). Currently managed via environment variables.",
  "requestedConfig": {
    "enabled": true,
    "discountAmount": 7500,
    "expiryDays": 60
  }
}
```

**Status Code**: `501 Not Implemented`

**⚠️ PENDING Todo #17**: This endpoint validates input but returns 501 error. Once `SystemConfig` model is created (Todo #17), this will:

1. Update `SystemConfig` document with new bundle settings
2. Return `200` with updated config
3. Allow admins to change settings without server restart

---

#### `PUT /api/promo-codes/:id/deactivate` (Admin Only)

Deactivate a promo code (prevents future use).

**Response**:

```json
{
  "success": true,
  "message": "Promo code deactivated successfully.",
  "code": {
    "_id": "...",
    "code": "BUNDLE50",
    "isActive": false
  }
}
```

**Validation**:

- Code must exist
- Code must currently be active

**Use Cases**:

- Manually disable compromised codes
- Cancel codes before expiration
- Revoke staff access

**Error Responses**:

- `400`: Invalid ID, code already deactivated
- `404`: Code not found

---

## Implementation Details

### Controller Structure

**File**: `backend/src/controllers/promoCodeController.ts`

**Methods**:

1. `getMyPromoCodes(req, res)` - User's codes with filters
2. `validatePromoCode(req, res)` - Validate code for program
3. `getAllPromoCodes(req, res)` - Admin list with pagination
4. `createStaffCode(req, res)` - Admin create staff code
5. `getBundleConfig(req, res)` - Admin get bundle config
6. `updateBundleConfig(req, res)` - Admin update bundle config (501)
7. `deactivatePromoCode(req, res)` - Admin deactivate code

**Error Handling**:

- All methods wrapped in try-catch
- 401 for unauthenticated requests
- 400 for validation errors
- 404 for not found
- 500 for server errors
- Consistent JSON response format

### Routes Structure

**File**: `backend/src/routes/promoCodes.ts`

**Middleware Chain**:

```typescript
router.use(authenticate); // All routes require authentication

// User routes - no additional middleware
router.get("/my-codes", ...);
router.post("/validate", ...);

// Admin routes - require requireAdmin middleware
router.get("/", requireAdmin, ...);
router.post("/staff", requireAdmin, ...);
router.get("/config", requireAdmin, ...);
router.put("/config", requireAdmin, ...);
router.put("/:id/deactivate", requireAdmin, ...);
```

**Mounted At**: `/api/promo-codes` (registered in `routes/index.ts`)

---

## Database Queries

### Efficient Indexes Used

The PromoCode model has indexes that optimize these queries:

1. **`code` (unique)**: Used by `validatePromoCode()` - O(1) lookup
2. **`ownerId + isActive + isUsed` (compound)**: Used by `getMyPromoCodes()` with filters
3. **`type + isActive`**: Used by `getAllPromoCodes()` type filter
4. **`expiresAt + isUsed`**: Used by expiry checks

### Population Strategy

**User Endpoints**: Minimal population (excludedProgramId, usedForProgramId)  
**Admin Endpoints**: Full population (ownerId, allowedProgramIds, excluded/used programs)

**Rationale**: Users don't need to see code owner details; admins need full context.

---

## Security Features

### Authentication & Authorization

✅ All routes require `authenticate` middleware (JWT token)  
✅ Admin routes require `requireAdmin` middleware (role check)  
✅ Bundle code ownership verified before use  
✅ User can only see their own codes (`ownerId` filter)

### Input Validation

✅ MongoDB ObjectId validation for IDs  
✅ Type checking for all inputs  
✅ Range validation (discountPercent: 0-100, discountAmount: 1000-20000)  
✅ Date validation (expiresAt must be future)  
✅ Code format (auto-generated, uppercase, 8 chars)

### Rate Limiting

⚠️ **TODO**: Consider adding rate limiting to `/validate` endpoint to prevent brute-force code guessing.

**Recommendation**: Add Redis-based rate limiter allowing 10 validation attempts per minute per user.

---

## Testing Coverage

### Manual Testing Checklist

**User Endpoints**:

- [ ] GET `/my-codes` - All codes
- [ ] GET `/my-codes?status=active` - Active codes only
- [ ] GET `/my-codes?status=expired` - Expired codes only
- [ ] GET `/my-codes?status=used` - Used codes only
- [ ] POST `/validate` - Valid code for program
- [ ] POST `/validate` - Invalid code
- [ ] POST `/validate` - Expired code
- [ ] POST `/validate` - Used code
- [ ] POST `/validate` - Bundle code excluded program
- [ ] POST `/validate` - Staff code allowed programs
- [ ] POST `/validate` - Ownership check (bundle codes)

**Admin Endpoints**:

- [ ] GET `/` - All codes
- [ ] GET `/?type=bundle_discount` - Bundle codes only
- [ ] GET `/?type=staff_access` - Staff codes only
- [ ] GET `/?status=active` - Active codes
- [ ] GET `/?search=BUNDLE` - Search by code
- [ ] GET `/?search=john` - Search by owner name
- [ ] GET `/?page=2&limit=10` - Pagination
- [ ] POST `/staff` - Create staff code (all programs)
- [ ] POST `/staff` - Create staff code (specific programs)
- [ ] POST `/staff` - Create with expiration
- [ ] POST `/staff` - Invalid user ID (404)
- [ ] POST `/staff` - Invalid discount percent (400)
- [ ] GET `/config` - Get bundle config
- [ ] PUT `/config` - Update bundle config (501 for now)
- [ ] PUT `/:id/deactivate` - Deactivate code
- [ ] PUT `/:id/deactivate` - Already deactivated (400)

**Authorization Tests**:

- [ ] User cannot access admin endpoints (403)
- [ ] Non-admin cannot access admin endpoints (403)
- [ ] Unauthenticated requests rejected (401)

### Integration Test Plan

**File**: `backend/tests/integration/promoCodes.integration.test.ts` (Todo #22)

**Test Suites**:

1. **User Code Retrieval**: Test filtering logic (active/expired/used)
2. **Code Validation**: Test all validation scenarios
3. **Admin Code Listing**: Test search, filters, pagination
4. **Staff Code Creation**: Test with various configurations
5. **Bundle Config**: Test GET endpoint (PUT in Todo #17)
6. **Code Deactivation**: Test deactivation flow
7. **Authorization**: Test role-based access control

---

## Known Limitations & Future Work

### 1. Bundle Config Update Not Implemented (Todo #17)

**Current State**: `PUT /api/promo-codes/config` returns `501 Not Implemented`

**Why**: Requires `SystemConfig` model to store settings in database

**Timeline**: Todo #17 will implement:

- `backend/src/models/SystemConfig.ts`
- Update `getBundleConfig()` to read from database
- Update `updateBundleConfig()` to write to database
- Migrate env vars to database on first load

### 2. No Rate Limiting on Validation Endpoint

**Risk**: Attackers could brute-force guess promo codes

**Mitigation**: Add rate limiter in future (10 requests/minute per user)

### 3. No Email Notification for Staff Codes

**Current State**: Admin creates code, but user not notified

**Future**: Add optional email notification when creating staff codes (checkbox in admin UI)

### 4. No Code Usage History

**Current State**: Only stores `usedAt` and `usedForProgramId` (single use)

**Note**: This is correct - codes are single-use. But future analytics might want usage attempt history.

### 5. Search Performance for Large Datasets

**Current State**: Search queries `User` collection, then filters promo codes

**Optimization**: For 10,000+ codes, consider adding `ownerEmail` field to PromoCode for direct search without JOIN

---

## API Documentation

Full API documentation will be added in **Todo #24** (`docs/PROMO_CODE_API_DOCS.md`) with:

- Detailed endpoint specifications
- Request/response examples
- Authentication requirements
- Error code reference
- Postman collection

---

## Environment Variables

No new environment variables added (bundle config vars already added in Todo #15).

**Reminder**: These are temporary and will be replaced by database config in Todo #17.

---

## Deployment Notes

### Prerequisites

- PromoCode model (Todo #12) ✅
- Purchase model updates (Todo #13) ✅
- Checkout API promo support (Todo #14) ✅
- Webhook bundle generation (Todo #15) ✅

### Steps

1. Deploy controller and routes files
2. Restart backend server
3. Verify routes registered: `GET /api/health` then check logs
4. Test user endpoints with authenticated request
5. Test admin endpoints with admin user

### Database Indexes

No new indexes required - PromoCode model already has all necessary indexes from Todo #12.

---

## Summary

✅ **7 API endpoints** created (2 user, 5 admin)  
✅ **560+ lines** of controller code  
✅ **75+ lines** of route definitions  
✅ **Full validation** and error handling  
✅ **Security** via authentication and authorization middleware  
✅ **Efficient queries** using existing database indexes  
✅ **Pagination** for admin listing (max 100 per page)  
✅ **Search** by code or owner name/email  
✅ **Filtering** by type and status  
✅ **Type-safe** TypeScript implementation

**Next Steps**:

- Todo #17: Implement SystemConfig model and enable bundle config updates
- Todo #18: Replace mock PromoCodeService in frontend with API calls
- Todo #19-21: Build admin UI tabs
- Todo #22: Write integration tests for all endpoints

---

**Completed**: 2025-10-18  
**By**: GitHub Copilot  
**Duration**: ~2 hours design + implementation
