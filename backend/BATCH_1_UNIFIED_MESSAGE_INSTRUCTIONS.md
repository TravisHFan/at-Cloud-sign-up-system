# Batch 1: System Messages Extraction Instructions

## Overview

Extract 6 system message methods from `unifiedMessageController.ts` (1,408 lines) into specialized controllers.

**CRITICAL**: Exact character-by-character copy. Zero AI modifications.

---

## Extraction Files Created (6 files)

1. **SystemMessagesRetrievalController.ts** (256 lines)
   - Method: `getSystemMessages` (lines 90-263)
2. **SystemMessagesCreationController.ts** (275 lines)
   - Method: `createSystemMessage` (lines 265-498)
3. **SystemMessagesReadController.ts** (97 lines)
   - Method: `markSystemMessageAsRead` (lines 500-566)
4. **SystemMessagesDeletionController.ts** (97 lines)
   - Method: `deleteSystemMessage` (lines 568-637)
5. **TargetedSystemMessagesController.ts** (143 lines)
   - Method: `createTargetedSystemMessage` (lines 1179-1295)
6. **WelcomeMessageStatusController.ts** (44 lines)
   - Method: `checkWelcomeMessageStatus` (lines 1034-1069)

**Total extraction**: 912 lines → 6 specialized controllers

---

## Step-by-Step Instructions

### Step 1: Delete 6 method implementations from main file

Open `backend/src/controllers/unifiedMessageController.ts` and delete these 6 method bodies:

**DELETE #1**: Lines 90-263 (174 lines) - `getSystemMessages`

- Start: `  static async getSystemMessages(req: Request, res: Response): Promise<void> {`
- End: `    }\n  }`
- **Keep closing brace of class but DELETE the method**

**DELETE #2**: Lines 265-498 (234 lines) - `createSystemMessage`

- Start: `  static async createSystemMessage(req: Request, res: Response): Promise<void> {`
- End: `    }\n  }`

**DELETE #3**: Lines 500-566 (67 lines) - `markSystemMessageAsRead`

- Start: `  static async markSystemMessageAsRead(`
- End: `    }\n  }`

**DELETE #4**: Lines 568-637 (70 lines) - `deleteSystemMessage`

- Start: `  static async deleteSystemMessage(req: Request, res: Response): Promise<void> {`
- End: `    }\n  }`

**DELETE #5**: Lines 1179-1295 (117 lines) - `createTargetedSystemMessage`

- Start: `  static async createTargetedSystemMessage(`
- End: `    }\n  }`

**DELETE #6**: Lines 1034-1069 (36 lines) - `checkWelcomeMessageStatus`

- Start: `  static async checkWelcomeMessageStatus(`
- End: `    }\n  }`

**After deletion**: File should be ~696 lines (1,408 - 698 deleted)

---

### Step 2: Add delegation methods (insert where original methods were)

**INSERT #1**: After line 89 (after `// ============================================` comment)

```typescript
  static async getSystemMessages(req: Request, res: Response): Promise<void> {
    const { default: SystemMessagesRetrievalController } = await import(
      "./message/SystemMessagesRetrievalController"
    );
    return SystemMessagesRetrievalController.getSystemMessages(req, res);
  }
```

**INSERT #2**: After createSystemMessage deletion point

```typescript
  static async createSystemMessage(req: Request, res: Response): Promise<void> {
    const { default: SystemMessagesCreationController } = await import(
      "./message/SystemMessagesCreationController"
    );
    return SystemMessagesCreationController.createSystemMessage(req, res);
  }
```

**INSERT #3**: After markSystemMessageAsRead deletion point

```typescript
  static async markSystemMessageAsRead(
    req: Request,
    res: Response
  ): Promise<void> {
    const { default: SystemMessagesReadController } = await import(
      "./message/SystemMessagesReadController"
    );
    return SystemMessagesReadController.markSystemMessageAsRead(req, res);
  }
```

**INSERT #4**: After deleteSystemMessage deletion point

```typescript
  static async deleteSystemMessage(req: Request, res: Response): Promise<void> {
    const { default: SystemMessagesDeletionController } = await import(
      "./message/SystemMessagesDeletionController"
    );
    return SystemMessagesDeletionController.deleteSystemMessage(req, res);
  }
```

**INSERT #5**: After createTargetedSystemMessage deletion point (line ~1179)

```typescript
  static async createTargetedSystemMessage(
    messageData: {
      title: string;
      content: string;
      type?: string;
      priority?: string;
      hideCreator?: boolean;
      metadata?: Record<string, unknown>;
    },
    targetUserIds: string[],
    creator?: {
      id: string;
      firstName: string;
      lastName: string;
      username: string;
      avatar?: string;
      gender: string;
      authLevel: string;
      roleInAtCloud?: string;
    }
  ): Promise<IMessage> {
    const { default: TargetedSystemMessagesController } = await import(
      "./message/TargetedSystemMessagesController"
    );
    return TargetedSystemMessagesController.createTargetedSystemMessage(
      messageData,
      targetUserIds,
      creator
    );
  }
```

**INSERT #6**: After checkWelcomeMessageStatus deletion point (line ~1034)

```typescript
  static async checkWelcomeMessageStatus(
    req: Request,
    res: Response
  ): Promise<void> {
    const { default: WelcomeMessageStatusController } = await import(
      "./message/WelcomeMessageStatusController"
    );
    return WelcomeMessageStatusController.checkWelcomeMessageStatus(req, res);
  }
```

**After insertion**: File should be ~860 lines (696 base + 164 delegation lines)

---

## Verification Checklist

After completing edits, verify:

- [ ] `unifiedMessageController.ts` is ~860 lines (target: 850-870 range)
- [ ] All 6 extraction files created in `backend/src/controllers/message/`
- [ ] No TypeScript errors: `npm run build` in backend folder
- [ ] Tests pass: Run integration tests
- [ ] All original method signatures preserved
- [ ] Delegation pattern consistent across all 6 methods

---

## Expected Results

**Before Batch 1**:

- Main file: 1,408 lines (monolithic)

**After Batch 1** (target):

- Main file: ~860 lines (delegation + remaining 10 methods)
- 6 specialized controllers created
- Reduction: 548 lines (38.9%)
- Remaining: 10 methods for Batch 2 and 3

**Final target after all 3 batches**: ~200 lines (85.8% reduction)

---

## Notes

- **Method preservation**: All 6 methods are exact copies from original
- **Type safety**: All type definitions preserved in extraction files
- **Helper functions**: `getUserState()` helper duplicated where needed
- **Import paths**: Adjusted to `../../models/` and `../../services/` (two levels up)
- **Pattern consistency**: Same delegation pattern as guest/purchase controllers

---

## When Complete

Type: "I have done. Please verify"
