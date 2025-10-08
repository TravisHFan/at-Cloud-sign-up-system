# Version Management Guide

**Last Updated**: 2025-10-08  
**Status**: ✅ Implemented

## Overview

This project uses an automated version management system that eliminates manual version updates across the codebase. The version is defined once in `package.json` and automatically injected into the application at build time.

---

## How It Works

### Single Source of Truth

**Version Location**: `frontend/package.json`

```json
{
  "name": "frontend",
  "version": "2.1.4" // ← Update this ONE place
}
```

### Automatic Injection

**Build-Time Replacement**: Vite automatically injects the version from `package.json` into the compiled code.

**Configuration** (`frontend/vite.config.ts`):

```typescript
import packageJson from "./package.json";

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  // ... rest of config
});
```

### Usage in Code

**Footer Component** (`frontend/src/components/common/Footer.tsx`):

```tsx
export default function Footer() {
  const appVersion = __APP_VERSION__;

  return (
    <footer>
      <span>Version {appVersion}</span>
    </footer>
  );
}
```

---

## How to Update Version

### Manual Update (For Releases)

**Step 1**: Edit `frontend/package.json`

```bash
cd frontend
# Change version field from 2.1.4 to 2.1.5 (example)
```

**Step 2**: Commit the change

```bash
git add frontend/package.json
git commit -m "chore: bump version to 2.1.5"
```

**Step 3**: Build and deploy

```bash
npm run build
# Version 2.1.5 will appear in Footer automatically
```

### Automated Update (Recommended for CI/CD)

You can use `npm version` to bump version and create git tags automatically:

```bash
cd frontend

# For patch releases (2.1.4 → 2.1.5)
npm version patch

# For minor releases (2.1.4 → 2.2.0)
npm version minor

# For major releases (2.1.4 → 3.0.0)
npm version major
```

This command:

- ✅ Updates `package.json` version
- ✅ Creates a git commit
- ✅ Creates a git tag (e.g., `v2.1.5`)

---

## TypeScript Support

The version constant is properly typed for TypeScript:

**Type Declaration** (`frontend/src/types/globals.d.ts`):

```typescript
declare const __APP_VERSION__: string;
```

This provides:

- ✅ IntelliSense autocomplete
- ✅ Type safety (always a string)
- ✅ Compile-time error detection

---

## Benefits

### Before (Manual)

- ❌ Hardcoded `Version 2.1.4` in multiple places
- ❌ Easy to forget to update
- ❌ Version can be inconsistent across files
- ❌ Manual find-and-replace before each deployment

### After (Automated)

- ✅ Single source of truth in `package.json`
- ✅ Impossible to forget (automatic injection)
- ✅ Always consistent across entire app
- ✅ Zero manual work at deployment time
- ✅ CI/CD ready
- ✅ Git-friendly (version changes tracked in package.json)

---

## CI/CD Integration

### Example GitHub Actions Workflow

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      # Auto-bump version on main branch
      - name: Bump version
        run: |
          cd frontend
          npm version patch --no-git-tag-version
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add package.json
          git commit -m "chore: bump version [skip ci]"
          git push

      - name: Build
        run: npm run build

      - name: Deploy
        run: # your deployment commands
```

---

## Testing

### Development Mode

```bash
cd frontend
npm run dev
# Open http://localhost:5173
# Check Footer - should show "Version 2.1.4"
```

### Production Build

```bash
cd frontend
npm run build
npm run preview
# Check Footer - should show current version from package.json
```

### Type Check

```bash
cd frontend
npm run type-check
# Should pass without errors
```

---

## Troubleshooting

### Version Not Updating

**Problem**: Footer still shows old version after updating `package.json`

**Solution**: Rebuild the application

```bash
cd frontend
npm run build
```

Development mode (Vite HMR) should pick up changes automatically, but sometimes a full restart helps:

```bash
# Stop dev server (Ctrl+C)
npm run dev
```

### TypeScript Errors

**Problem**: `Cannot find name '__APP_VERSION__'`

**Solution**: Ensure `src/types/globals.d.ts` exists and is included in TypeScript compilation:

```typescript
// frontend/src/types/globals.d.ts
declare const __APP_VERSION__: string;
```

If error persists, restart TypeScript server in VS Code:

- Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows)
- Type "TypeScript: Restart TS Server"
- Press Enter

---

## Best Practices

### Semantic Versioning

Follow [Semantic Versioning](https://semver.org/) guidelines:

- **MAJOR** (3.0.0): Breaking changes
- **MINOR** (2.2.0): New features, backward compatible
- **PATCH** (2.1.5): Bug fixes

### Version Bump Checklist

Before bumping version:

1. ✅ All tests passing
2. ✅ Code reviewed and approved
3. ✅ CHANGELOG.md updated
4. ✅ Ready to deploy

### Release Process

```bash
# 1. Ensure clean working directory
git status

# 2. Update CHANGELOG.md with release notes
# Edit manually

# 3. Bump version and create tag
cd frontend
npm version patch -m "chore: release v%s"

# 4. Push with tags
git push origin main --tags

# 5. Build and deploy
npm run build
```

---

## Additional Version Display Locations

### Add Version to Other Components

You can use `__APP_VERSION__` anywhere in your frontend code:

```tsx
// Example: Add to sidebar
export function Sidebar() {
  return (
    <div>
      <p>App Version: {__APP_VERSION__}</p>
    </div>
  );
}

// Example: Add to About page
export function AboutPage() {
  return (
    <div>
      <h1>About @Cloud</h1>
      <p>Version {__APP_VERSION__}</p>
      <p>Build Date: {new Date().toISOString()}</p>
    </div>
  );
}
```

### Backend Version (Optional)

If you want to display backend version too, add similar setup in `backend/`:

1. Update `backend/package.json` version
2. Create `backend/src/config/version.ts`:

```typescript
export const VERSION = process.env.npm_package_version || "unknown";
```

3. Use in API responses:

```typescript
app.get("/api/version", (req, res) => {
  res.json({ version: VERSION });
});
```

---

## Related Documentation

- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [Semantic Versioning](https://semver.org/)
- [npm version command](https://docs.npmjs.com/cli/v9/commands/npm-version)

---

## Migration Complete ✅

**Previous**: Hardcoded `Version 2.1.4` in Footer.tsx  
**Current**: Dynamic `Version {__APP_VERSION__}` from package.json  
**Files Changed**:

- ✅ `frontend/package.json` - Added version 2.1.4
- ✅ `frontend/vite.config.ts` - Added define config
- ✅ `frontend/src/components/common/Footer.tsx` - Using dynamic version
- ✅ `frontend/src/types/globals.d.ts` - TypeScript declarations

**Next Deployment**: Just update `frontend/package.json` version and build. Done!
