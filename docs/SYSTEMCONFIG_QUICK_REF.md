# SystemConfig Model - Quick Reference

**Model**: `SystemConfig`  
**Collection**: `systemconfigs`  
**Purpose**: Store system-wide configuration in MongoDB

---

## Bundle Discount Config

### Read Configuration

```typescript
import { SystemConfig } from "./models";

const config = await SystemConfig.getBundleDiscountConfig();
// Returns: { enabled: boolean, discountAmount: number, expiryDays: number }
```

### Update Configuration

```typescript
const updated = await SystemConfig.updateBundleDiscountConfig(
  {
    enabled: true,
    discountAmount: 7500, // $75.00 in cents
    expiryDays: 60,
  },
  "admin@atcloud.com" // updatedBy
);
```

### Initialize Defaults (Server Startup)

```typescript
await SystemConfig.initializeDefaults();
// Creates default config if doesn't exist
// Migrates from env vars if present
```

---

## Validation Rules

- **enabled**: Must be boolean
- **discountAmount**: 1000-20000 (cents) = $10-$200
- **expiryDays**: 7-365 days

---

## API Endpoints

### GET /api/promo-codes/config (Admin)

Returns current bundle discount configuration from database.

### PUT /api/promo-codes/config (Admin)

Updates bundle discount configuration in database.

**Request Body**:

```json
{
  "enabled": true,
  "discountAmount": 7500,
  "expiryDays": 60
}
```

---

## Environment Variables (Optional)

```bash
# OPTIONAL: Only used for migration on first startup
# BUNDLE_DISCOUNT_ENABLED=true
# BUNDLE_DISCOUNT_AMOUNT=5000
# BUNDLE_EXPIRY_DAYS=30
```

After first server start, these values are migrated to database and env vars can be removed.

---

## Database Document Example

```javascript
{
  _id: ObjectId("..."),
  key: "bundle_discount_config",
  value: {
    enabled: true,
    discountAmount: 5000,
    expiryDays: 30
  },
  description: "Bundle discount auto-generation configuration",
  updatedBy: "admin@atcloud.com",
  createdAt: ISODate("2025-10-18T10:00:00Z"),
  updatedAt: ISODate("2025-10-18T15:30:00Z")
}
```

---

## Migration Guide

1. **First server start**: Config auto-created from env vars (if present) or defaults
2. **Verify**: GET /api/promo-codes/config shows correct values
3. **Remove env vars**: Delete BUNDLE*DISCOUNT*\* from .env file
4. **Restart**: Config still works - reads from database

---

## Benefits

✅ No server restart needed to change settings  
✅ Admin UI can update config (Todo #21)  
✅ Audit trail with updatedBy and timestamps  
✅ Per-environment configuration  
✅ Version control safe (not in .env)

---

**See Also**:

- Full documentation: `docs/TODO_17_SYSTEMCONFIG_COMPLETE.md`
- API reference: `docs/PROMO_CODE_API_QUICK_REF.md`
