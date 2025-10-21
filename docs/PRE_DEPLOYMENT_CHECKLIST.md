# Pre-Deployment Checklist

## Quick Check Scripts

### From Root Directory

```bash
# Full pre-deployment check (⚠️ Takes time - clean installs both workspaces)
npm run pre-deploy

# Quick verification (lint + type-check)
npm run verify

# Check dependency tree
npm run check-deps

# Clean install specific workspace
npm run clean-install:frontend
npm run clean-install:backend
npm run clean-install  # Both workspaces
```

### From Backend Directory

```bash
cd backend

# Quick backend-only pre-deploy check
npm run pre-deploy

# Clean install backend only
npm run clean-install

# Check backend dependencies
npm run check-deps
```

### From Frontend Directory

```bash
cd frontend

# Quick frontend-only pre-deploy check
npm run pre-deploy

# Clean install frontend only
npm run clean-install

# Check frontend dependencies
npm run check-deps
```

## What Each Script Does

### `npm run pre-deploy`

**Purpose**: Simulates a production deployment locally

**Steps**:

1. Removes `node_modules` (clean slate)
2. Fresh `npm install` (catches missing dependencies)
3. Runs `verify` (lint + type-check)
4. Runs `build` (production build)
5. Runs `test` (all tests)

**When to use**: Before pushing code that will be deployed to production

### `npm run verify`

**Purpose**: Quick code quality check

**Steps**:

1. Runs ESLint
2. Runs TypeScript type-check

**When to use**: Before every commit

### `npm run clean-install`

**Purpose**: Fresh install to catch dependency issues

**Steps**:

1. Removes `node_modules`
2. Fresh `npm install`

**When to use**:

- When you suspect dependency issues
- Before testing a deployment scenario
- After changing `package.json`

### `npm run check-deps`

**Purpose**: List all direct dependencies

**When to use**:

- Checking if a package is installed
- Verifying dependency versions
- Looking for missing peer dependencies

## Common Deployment Issues

### Issue 1: Missing Dependencies

**Symptom**: Build works locally but fails in production

**Cause**: Package used in code but not in `package.json`

**Example**:

```
error TS2307: Cannot find module 'date-fns'
```

**Solution**:

```bash
# Add to package.json
npm install date-fns --save

# Verify it works
npm run pre-deploy
```

### Issue 2: TypeScript Errors

**Symptom**: Type-check passes locally but fails in CI/CD

**Cause**: Using `any` types or incorrect type assertions

**Solution**:

```bash
# Check types
npm run type-check

# Fix errors, then verify
npm run verify
```

### Issue 3: Build Failures

**Symptom**: Vite build fails in production

**Cause**: Import errors, missing files, or TypeScript errors

**Solution**:

```bash
# Test production build
npm run build

# If fails, check:
# 1. Import paths (case-sensitive in Linux)
# 2. Missing files
# 3. TypeScript errors
```

## Best Practices

### Before Every Commit

```bash
npm run verify
```

### Before Every Push to Main

```bash
npm test
```

### Before Deployment

```bash
npm run pre-deploy
```

### After Changing Dependencies

```bash
npm run clean-install
npm run build
npm test
```

## Why Local Dev Can Work When Production Fails

### Node Modules Persistence

- **Local**: `node_modules` persists between runs
- **Production**: Fresh `npm install` every time

### Ghost Dependencies

- **Local**: Manual `npm install package` adds to `node_modules` but not `package.json`
- **Production**: Only installs from `package.json`

### Cache Differences

- **Local**: npm cache may serve packages
- **Production**: Clean environment, no cache

### Example Scenario

```bash
# Day 1: You manually install a package
npm install date-fns
# ✅ Works - package in node_modules
# ❌ Forgot to save to package.json

# Day 2-30: Dev server runs fine
npm run dev
# ✅ Works - node_modules still has date-fns

# Day 31: Deploy to production
# ❌ FAILS - date-fns not in package.json
```

**Fix**:

```bash
# Add to package.json
npm install date-fns --save

# Verify with clean install
npm run pre-deploy
```

## Quick Reference Card

| Command                 | Scope           | Time  | Use Case                   |
| ----------------------- | --------------- | ----- | -------------------------- |
| `npm run verify`        | Code quality    | ~30s  | Before commit              |
| `npm test`              | All tests       | ~2min | Before push                |
| `npm run build`         | Build only      | ~5s   | Quick build check          |
| `npm run clean-install` | Fresh install   | ~30s  | After package.json changes |
| `npm run pre-deploy`    | Full check      | ~3min | Before deployment          |
| `npm run check-deps`    | Dependency list | ~1s   | Check installed packages   |

## Automated Checks

Consider adding these to your CI/CD pipeline:

```yaml
# .github/workflows/deploy.yml
- name: Verify code quality
  run: npm run verify

- name: Run tests
  run: npm test

- name: Build production
  run: npm run build
```

## Troubleshooting

### "Script not found" Error

**Issue**: Running script from wrong directory

**Solution**:

```bash
# If in backend/frontend, go to root
cd ..

# Or use workspace-specific command
cd backend && npm run pre-deploy
```

### Clean Install Too Slow

**Issue**: `npm run pre-deploy` takes too long

**Solution**: Use lighter checks

```bash
# Just verify code quality
npm run verify

# Or just build
npm run build
```

### Dependency Conflicts

**Issue**: npm install fails with peer dependency errors

**Solution**:

```bash
# For frontend (uses legacy peer deps)
cd frontend
npm install --legacy-peer-deps

# For backend (standard)
cd backend
npm install
```

---

**Last Updated**: 2025-10-21  
**Version**: 1.0.0
