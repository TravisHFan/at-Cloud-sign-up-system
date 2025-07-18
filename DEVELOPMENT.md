# Development Guide

## Prerequisites

- Node.js 18+ (recommended: 20+)
- MongoDB 7.0+
- Git
- VS Code (recommended IDE)

## Development Environment Setup

### 1. Clone and Initial Setup

```bash
git clone https://github.com/TravisHFan/at-Cloud-sign-up-system.git
cd at-Cloud-sign-up-system
npm install
npm run install-all
```

### 2. Environment Configuration

#### Backend Environment

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` with your settings:

```env
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/atcloud-signup
JWT_ACCESS_SECRET=your-generated-access-secret
JWT_REFRESH_SECRET=your-generated-refresh-secret
PORT=5001
FRONTEND_URL=http://localhost:5173
```

#### Frontend Environment (Optional)

```bash
cd frontend
cp .env.example .env
```

### 3. Database Setup

```bash
# Make sure MongoDB is running
# On macOS with Homebrew:
brew services start mongodb-community

# Create initial data (optional)
cd backend
npm run setup-users
npm run create-sample-data
```

## Environment Setup

### Backend Environment Variables

1. Copy the example environment file:

```bash
cd backend
cp .env.example .env
```

2. Update the `.env` file with your specific configuration:

- Database URLs for your MongoDB instances
- JWT secrets (keep the generated secure ones)
- Email service credentials (if using email features)
- Redis configuration (if using caching)

### Frontend Environment Variables

1. Copy the example environment file:

```bash
cd frontend
cp .env.example .env
```

2. Update the `.env` file with your configuration:

- API URL (default: http://localhost:5001)
- Any frontend-specific feature flags

**Important**: Never commit `.env` files to Git. They are excluded in `.gitignore` for security.

## Development Workflow

### Starting Development Servers

#### Option 1: Start Everything Together

```bash
npm start
```

#### Option 2: Start Services Individually

```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend
cd frontend && npm run dev
```

### Development URLs

- Frontend: http://localhost:5173
- Backend API: http://localhost:5001
- API Documentation: http://localhost:5001/api-docs
- Health Check: http://localhost:5001/health

## Testing

### Backend Testing

```bash
cd backend

# Run all tests
npm test

# Watch mode for development
npm run test:watch

# Coverage report
npm run test:coverage

# Linting
npm run lint
npm run lint:fix
```

### Frontend Testing

```bash
cd frontend

# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Interactive UI
npm run test:ui
```

## Code Quality

### Linting Setup

Both frontend and backend have ESLint configured:

```bash
# Backend
cd backend && npm run lint

# Frontend
cd frontend && npm run lint
```

### Pre-commit Hooks (Recommended)

Install husky for git hooks:

```bash
npm install -D husky lint-staged
npx husky install
```

Add to `package.json`:

```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "git add"],
    "*.{js,jsx,ts,tsx,json,css,md}": ["prettier --write", "git add"]
  }
}
```

## Database Management

### MongoDB Operations

```bash
# Connect to MongoDB
mongosh

# Switch to project database
use atcloud-signup

# View collections
show collections

# View users
db.users.find().pretty()

# View events
db.events.find().pretty()
```

### Backup and Restore

```bash
# Backup
mongodump --db atcloud-signup --out ./backup

# Restore
mongorestore --db atcloud-signup ./backup/atcloud-signup
```

## API Development

### Adding New Endpoints

1. **Create Controller** (`backend/src/controllers/`)

```typescript
export class NewController {
  static async getItems(req: Request, res: Response): Promise<void> {
    // Implementation
  }
}
```

2. **Add Routes** (`backend/src/routes/`)

```typescript
import { NewController } from "../controllers/NewController";

router.get("/items", NewController.getItems);
```

3. **Add Swagger Documentation**

```typescript
/**
 * @swagger
 * /api/v1/items:
 *   get:
 *     summary: Get all items
 *     tags: [Items]
 *     responses:
 *       200:
 *         description: Success
 */
```

### API Testing with Postman/Insomnia

Import the OpenAPI spec from: `http://localhost:5001/api-docs.json`

## Frontend Development

### Component Structure

```
src/components/
├── common/          # Shared components
├── forms/           # Form components
├── layout/          # Layout components
└── ui/              # Basic UI components
```

### Adding New Components

```typescript
// src/components/NewComponent.tsx
import React from "react";

interface NewComponentProps {
  title: string;
}

export const NewComponent: React.FC<NewComponentProps> = ({ title }) => {
  return <div>{title}</div>;
};
```

### State Management

- Use React Context for global state
- React Hook Form for form state
- Custom hooks for business logic

## Debugging

### Backend Debugging

1. **VS Code Launch Configuration** (`.vscode/launch.json`):

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Backend",
  "program": "${workspaceFolder}/backend/src/index.ts",
  "outFiles": ["${workspaceFolder}/backend/dist/**/*.js"],
  "runtimeArgs": ["-r", "ts-node/register"]
}
```

2. **Chrome DevTools**: Use `--inspect` flag

```bash
npm run dev -- --inspect
```

### Frontend Debugging

- React Developer Tools
- Redux DevTools (if using Redux)
- Browser DevTools Network tab for API calls

## Performance Optimization

### Backend

- Use MongoDB indexes appropriately
- Implement caching with Redis
- Optimize database queries
- Use compression middleware

### Frontend

- Code splitting with React.lazy()
- Image optimization and compression
- Bundle analysis with `npm run build -- --analyze`
- Use React.memo for expensive components

## Deployment Preparation

### Environment-Specific Builds

```bash
# Staging
NODE_ENV=staging npm run build

# Production
NODE_ENV=production npm run build
```

### Environment Variables Checklist

- [ ] Strong JWT secrets
- [ ] Production MongoDB URI
- [ ] Email service configuration
- [ ] File storage configuration
- [ ] Error tracking (Sentry) setup
- [ ] Analytics setup

## Troubleshooting

### Common Issues

1. **MongoDB Connection Failed**

   - Check if MongoDB is running
   - Verify connection string
   - Check firewall settings

2. **Port Already in Use**

   ```bash
   # Kill process on port 5001
   lsof -ti:5001 | xargs kill -9

   # Kill process on port 5173
   lsof -ti:5173 | xargs kill -9
   ```

3. **TypeScript Errors**

   - Clear TypeScript cache: `rm -rf node_modules/.cache`
   - Restart TypeScript server in VS Code
   - Check tsconfig.json settings

4. **Test Failures**
   - Clear Vitest cache: `npm run test -- --reporter=verbose`
   - Check test database connection
   - Verify test environment variables

### Getting Help

1. Check existing GitHub issues
2. Review API documentation
3. Contact the development team
4. Check logs in `backend/logs/` directory

## Best Practices

### Code Style

- Use TypeScript for type safety
- Follow ESLint rules
- Write comprehensive tests
- Document complex functions
- Use meaningful variable names

### Git Workflow

- Create feature branches
- Write descriptive commit messages
- Keep commits atomic and small
- Use pull requests for code review

### Security

- Never commit secrets
- Use environment variables
- Validate all inputs
- Implement proper authentication
- Keep dependencies updated

---

Happy coding! 🚀
