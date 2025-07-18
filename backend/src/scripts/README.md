# Scripts Directory

## Directory Structure

```
src/scripts/
├── migrations/         # Database migration scripts
├── setup/             # Initial setup and sample data scripts
├── checkDatabases.ts  # Database inspection utility
└── README.md          # This file
```

## Script Categories

### Migration Scripts (`migrations/`)

- `migrateUserSchema.ts` - User schema migration utility

### Setup Scripts (`setup/`)

- `setupUsers.ts` - Initial user creation
- `createSampleData.ts` - Sample data generation
- `regenerateUsers.ts` - User data refresh utility

### Utility Scripts

- `checkDatabases.ts` - Database inspection and validation

## Available NPM Scripts

- `npm run setup-users` - Create initial admin users
- `npm run create-sample-data` - Generate sample data for development
- `npm run regenerate-users` - Regenerate user data
- `npm run migrate-user-schema` - Migrate user schema to latest version
- `npm run check-db` - Inspect database status and collections

## Usage Notes

- All scripts use environment variables from `.env` file
- Scripts connect to MongoDB using `MONGODB_URI` environment variable
- Default database: `atcloud-signup`
- Scripts are safe to run multiple times (idempotent where applicable)
- Performance testing tools

## Usage

Run scripts from the backend directory:

```bash
# Setup scripts
npm run setup-users
npm run create-sample-data

# Migration scripts (run manually)
npx ts-node src/scripts/migrations/migrateNotifications.ts

# Test scripts (run manually)
npx ts-node src/scripts/tests/testUnifiedSystem.ts
```
