# Role Templates Migration Guide

## ✅ Migration Complete

**Date**: 2025-10-09  
**Status**: Successfully migrated 4 event type templates to database

---

## What Was Migrated

The following templates were migrated from hardcoded files to the database:

| Event Type                       | Template Name                                     | Roles Count | Template ID              |
| -------------------------------- | ------------------------------------------------- | ----------- | ------------------------ |
| Conference                       | Default Conference Template                       | 14 roles    | 68e83ffaf09522b78a2c9f30 |
| Webinar                          | Default Webinar Template                          | 10 roles    | 68e83ffaf09522b78a2c9f37 |
| Effective Communication Workshop | Default Effective Communication Workshop Template | 20 roles    | 68e83ffaf09522b78a2c9f3c |
| Mentor Circle                    | Default Mentor Circle Template                    | 6 roles     | 68e83ffaf09522b78a2c9f41 |

**Creator**: Travis Fan (Super Admin) - ID: 68d4d98cd28dea4225b2c27c

---

## Migration Command Used

```bash
cd backend
npx ts-node src/scripts/migrate-role-templates.ts
```

---

## Verification Commands

### Check all templates:

```bash
mongosh atcloud-signup --quiet --eval "db.rolestemplates.find().forEach(t => print('Template:', t.name, '| Event Type:', t.eventType, '| Roles:', t.roles.length))"
```

### View detailed template structure:

```bash
mongosh atcloud-signup --quiet --eval "printjson(db.rolestemplates.findOne({eventType: 'Conference'}))"
```

### Count templates:

```bash
mongosh atcloud-signup --quiet --eval "print('Total templates:', db.rolestemplates.countDocuments())"
```

---

## Database Collection

**Collection Name**: `rolestemplates`

**Indexes**:

- `eventType_1` (ascending)
- `createdBy_1` (ascending)

**Document Structure**:

```json
{
  "_id": ObjectId,
  "name": String,
  "eventType": String,
  "roles": [
    {
      "name": String,
      "description": String,
      "maxParticipants": Number,
      "openToPublic": Boolean,
      "agenda": String,
      "startTime": String,
      "endTime": String
    }
  ],
  "createdBy": ObjectId (ref: User),
  "createdAt": Date,
  "updatedAt": Date
}
```

---

## What This Enables

Now that templates are in the database:

1. ✅ **Create Event** page will automatically load templates from database
2. ✅ **Edit Event** page has "Configure Templates" button
3. ✅ Users can navigate to `/dashboard/configure-roles-templates` to manage templates
4. ✅ Super Admin/Administrator/Leader can create new templates
5. ✅ Template creators can edit/delete their own templates
6. ✅ Super Admin/Administrator can edit/delete any template

---

## Testing the Feature

### 1. View Templates

Navigate to: `http://localhost:5173/dashboard/configure-roles-templates`

You should see:

- Conference (1 template)
- Webinar (1 template)
- Effective Communication Workshop (1 template)
- Mentor Circle (1 template)

### 2. Create New Event

Navigate to: `http://localhost:5173/dashboard/create-event`

1. Select event type (e.g., Conference)
2. Template should auto-apply (since only 1 template exists)
3. Check that roles are populated from database template

### 3. Create Additional Template

1. Go to Configure Templates page
2. Click "+ New Template" for any event type
3. Enter template name (e.g., "Advanced Conference Template")
4. Configure roles
5. Save

### 4. Test Multiple Templates

After creating a second template:

1. Go to Create Event
2. Select the event type with 2 templates
3. You should see a dropdown to choose which template
4. Select one and click "Confirm Template"

---

## Re-running Migration

The migration script is **safe to re-run**. It checks for existing templates and skips them:

```bash
cd backend
npx ts-node src/scripts/migrate-role-templates.ts
```

Output when templates already exist:

```
⏭️  Skipping Conference: Default template already exists
⏭️  Skipping Webinar: Default template already exists
...
📊 Migration Summary:
   ✅ Migrated: 0 templates
   ⏭️  Skipped: 4 templates (already exist)
```

---

## Rollback (If Needed)

If you need to reset templates to original state:

```bash
# Delete all templates
mongosh atcloud-signup --eval "db.rolestemplates.deleteMany({})"

# Re-run migration
cd backend
npx ts-node src/scripts/migrate-role-templates.ts
```

---

## Production Deployment

When deploying to production:

1. **Deploy Backend** with new models/routes
2. **Run Migration Script** on production database:
   ```bash
   MONGODB_URI=<production-uri> npx ts-node src/scripts/migrate-role-templates.ts
   ```
3. **Deploy Frontend** with new pages/components
4. **Verify**: Check that templates appear in production UI

---

## Troubleshooting

### Issue: Templates not loading in UI

**Check**:

1. Backend server running?
2. MongoDB connection successful?
3. Templates in database? (use verification commands above)
4. API endpoint accessible? Try: `curl http://localhost:3000/api/roles-templates`

### Issue: Cannot create new templates

**Check**:

1. User logged in?
2. User role is Super Admin, Administrator, or Leader?
3. Check browser console for errors
4. Check backend logs for permission errors

### Issue: Migration script fails

**Common Causes**:

- MongoDB not running: `brew services start mongodb-community`
- Wrong database URI in environment variables
- No Super Admin user exists (script will create one)

---

## Next Steps

- [ ] Write tests for role templates feature
- [ ] Run full test suite to verify no breaking changes
- [ ] Test feature in development environment
- [ ] Prepare for production deployment
- [ ] Train users on new template management UI

---

## Files Reference

**Migration Script**: `backend/src/scripts/migrate-role-templates.ts`  
**Model**: `backend/src/models/RolesTemplate.ts`  
**Controller**: `backend/src/controllers/rolesTemplateController.ts`  
**Routes**: `backend/src/routes/rolesTemplates.ts`  
**Frontend Pages**:

- `frontend/src/pages/ConfigureRolesTemplates.tsx`
- `frontend/src/pages/CreateRolesTemplate.tsx`
- `frontend/src/pages/EditRolesTemplate.tsx`

---

**Last Updated**: 2025-10-09  
**Status**: ✅ Migration Complete and Verified
