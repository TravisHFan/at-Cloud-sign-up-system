# Backend Services Architecture

## Directory Structure

```
src/services/
├── infrastructure/     # External integrations and infrastructure
│   └── emailService.ts
└── index.ts           # Service exports
```

## Service Layers

### Infrastructure Services

These services handle external integrations and infrastructure concerns:

- **EmailService**: Manages email sending and templates

## Business Logic Migration

**Note**: Business logic services (like NotificationService) have been consolidated into user-centric controllers for better performance and data isolation:

- **User Notifications**: `src/controllers/userNotificationController.ts`
- **System Messages**: `src/controllers/systemMessageController.ts`
- **Message Handling**: `src/controllers/messageController.ts`

## Usage

Import infrastructure services from the main index file:

```typescript
import { EmailService } from "../services";
```

## Service Principles

1. **Single Responsibility**: Each service has one clear purpose
2. **User-Centric Architecture**: Business logic is user-scoped for better performance
3. **Infrastructure Separation**: External integrations are separated from business logic
