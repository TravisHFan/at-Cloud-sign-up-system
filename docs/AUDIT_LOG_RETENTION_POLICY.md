# Audit Log Retention Policy

## Overview

The system automatically manages audit log retention to prevent unlimited database growth while maintaining compliance with typical audit requirements. Old audit logs are automatically deleted based on a configurable retention period.

## Configuration

### Environment Variables

| Variable                      | Default | Description                                                     |
| ----------------------------- | ------- | --------------------------------------------------------------- |
| `AUDIT_LOG_RETENTION_MONTHS`  | `12`    | Number of months to retain audit logs before automatic deletion |
| `AUDIT_LOG_TTL_FALLBACK_DAYS` | `730`   | Hard TTL limit in days (24 months) as fallback safety mechanism |

### Examples

```bash
# Retain audit logs for 18 months
AUDIT_LOG_RETENTION_MONTHS=18

# Retain audit logs for 6 months (short retention for high-volume systems)
AUDIT_LOG_RETENTION_MONTHS=6

# Set TTL fallback to 12 months (365 days)
AUDIT_LOG_TTL_FALLBACK_DAYS=365
```

## How It Works

### Dual-Layer Protection

1. **Primary Cleanup (Configurable)**: MaintenanceScheduler runs hourly and deletes logs older than `AUDIT_LOG_RETENTION_MONTHS`
2. **TTL Fallback (Safety Net)**: MongoDB TTL index automatically expires logs after `AUDIT_LOG_TTL_FALLBACK_DAYS` regardless of application state

### Cleanup Schedule

- **Frequency**: Every hour via MaintenanceScheduler
- **Initial Run**: 10 seconds after server startup
- **Method**: Bulk deletion using MongoDB `deleteMany()` with date-based filter

### Logging

The system logs all cleanup activities:

```
🗂️ Purged 25 old audit logs              (successful cleanup)
🗂️ No old audit logs to purge            (no cleanup needed)
Failed to purge old audit logs: <error>   (error condition)
```

## Implementation Details

### Model Method

```typescript
// Static method on AuditLog model
await AuditLog.purgeOldAuditLogs(retentionMonths?: number)
// Returns: { deletedCount: number }
```

### Database Indexes

```typescript
// Primary query index
{ action: 1, createdAt: -1 }

// TTL safety index
{ createdAt: 1 }, { expireAfterSeconds: TTL_FALLBACK_DAYS * 24 * 60 * 60 }
```

## Compliance Considerations

### Typical Audit Retention Requirements

- **SOX**: 7 years
- **GDPR**: Varies (typically 1-6 years depending on data type)
- **HIPAA**: 6 years minimum
- **General Business**: 1-3 years

### Recommended Settings

- **Development/Testing**: 1-3 months
- **Small Production**: 12 months (default)
- **Enterprise/Compliance**: 24-84 months depending on requirements

## Monitoring

### Metrics to Track

1. **Storage Growth**: Monitor audit log collection size
2. **Cleanup Frequency**: Ensure hourly cleanup runs successfully
3. **Retention Compliance**: Verify logs are deleted according to policy
4. **Error Rate**: Monitor cleanup failures

### Suggested Queries

```javascript
// Count logs by age ranges
db.auditlogs.aggregate([
  {
    $bucket: {
      groupBy: "$createdAt",
      boundaries: [
        new Date("2023-01-01"),
        new Date("2024-01-01"),
        new Date("2025-01-01"),
      ],
      default: "older",
      output: { count: { $sum: 1 } },
    },
  },
]);

// Find oldest audit log
db.auditlogs.find().sort({ createdAt: 1 }).limit(1);
```

## Troubleshooting

### Common Issues

1. **Logs Not Being Deleted**

   - Check MaintenanceScheduler is running
   - Verify `AUDIT_LOG_RETENTION_MONTHS` environment variable
   - Check server logs for cleanup errors

2. **Unexpected Bulk Deletions**

   - Verify TTL index settings
   - Check if retention period was recently changed
   - Review cleanup logs for large `deletedCount` values

3. **Performance Impact**
   - Monitor cleanup duration during high-volume periods
   - Consider adjusting cleanup frequency for very large datasets
   - Ensure proper indexing on `createdAt` field

### Manual Operations

```typescript
// Manual cleanup (if needed)
const result = await AuditLog.purgeOldAuditLogs(6); // 6-month retention
console.log(`Deleted ${result.deletedCount} logs`);

// Check retention policy
const retentionMonths = parseInt(
  process.env.AUDIT_LOG_RETENTION_MONTHS || "12",
  10
);
const cutoffDate = new Date();
cutoffDate.setMonth(cutoffDate.getMonth() - retentionMonths);
console.log(`Logs older than ${cutoffDate.toISOString()} will be deleted`);
```

## Security Considerations

- **Irreversible**: Deleted audit logs cannot be recovered
- **Compliance**: Ensure retention period meets regulatory requirements
- **Access Control**: Only administrators should modify retention settings
- **Backup Strategy**: Consider archiving critical logs before deletion

## Future Enhancements

- **Configurable cleanup frequency** (currently hourly)
- **Action-specific retention** (different retention for different log types)
- **Archive before delete** (export to external storage)
- **Retention policy API** (runtime configuration changes)
- **Cleanup metrics dashboard** (monitoring integration)
