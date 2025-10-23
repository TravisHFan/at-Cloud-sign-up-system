# Browser Dialogs to Replace with Custom UI

This document tracks all instances of browser-native dialogs (`alert()`, `confirm()`, `prompt()`) that should be replaced with custom modal components for consistency and better UX.

## ✅ Completed

### PurchaseHistory.tsx

- **Lines 68, 75, 89**: Replaced `alert()` and `confirm()` with custom modals
- Added `cancelConfirm` state for confirmation dialog
- Added `errorModal` state for error messages
- **Status**: ✅ Complete

### EnrollProgram.tsx

**Location**: `/Users/dr.hunter/CS Projects/at-Cloud-sign-up-system/frontend/src/pages/EnrollProgram.tsx`

- **Line 81**: Replaced `alert("This program is free...")` with AlertModal (type: info)
- **Line 106**: Replaced `alert("Failed to load program...")` with AlertModal (type: error)
- **Line 151**: Replaced `alert(message)` for checkout errors with AlertModal (type: warning/error)
  - Special handling for "Class Rep slots are full" error (type: warning)
- Added `alertModal` state with support for custom onClose callbacks
- **Status**: ✅ Complete (2025-10-19)

## 🔄 Pending Replacements

### EditProgram.tsx

**Location**: `/Users/dr.hunter/CS Projects/at-Cloud-sign-up-system/frontend/src/pages/EditProgram.tsx`

1. **Line 439**: `alert("Failed to load program. Please try again.");`

   - **Context**: Error loading program data
   - **Replacement**: Use error modal with retry option

2. **Line 539**: `alert("Failed to update program. Please try again.");`

   - **Context**: Error updating program
   - **Replacement**: Use error modal

3. **Line 876**: `alert("Failed to upload image");`
   - **Context**: Image upload failure
   - **Replacement**: Use error modal

### PurchaseSuccess.tsx

**Location**: `/Users/dr.hunter/CS Projects/at-Cloud-sign-up-system/frontend/src/pages/PurchaseSuccess.tsx`

1. **Line 34**: `alert("Invalid payment session");`

   - **Context**: Session ID validation error
   - **Replacement**: Use error modal with redirect to programs

2. **Line 231**: `alert("Purchase completed! Refreshing...");`

   - **Context**: Manual completion success (dev/testing)
   - **Replacement**: Use success modal or toast notification

3. **Line 234**: `alert("Error: Purchase is still pending. Please refresh the page.");`

   - **Context**: Purchase still pending after retry
   - **Replacement**: Use warning modal with refresh button

4. **Line 240**: `alert("Error completing purchase");`
   - **Context**: Manual completion failure
   - **Replacement**: Use error modal

### EventDetail.tsx

**Location**: `/Users/dr.hunter/CS Projects/at-Cloud-sign-up-system/frontend/src/pages/EventDetail.tsx`

1. **Line 862**: `const confirm = window.confirm("Are you sure you want to decline this guest?");`

   - **Context**: Guest decline confirmation
   - **Replacement**: Use custom confirmation modal
   - **Note**: Already has `cancelConfirm` modal at lines 3920+, should consolidate

2. **Line 4095**: `const url = window.prompt("Enter URL", "https://");`
   - **Context**: Rich text editor - inserting link URL
   - **Replacement**: Use custom input modal with URL validation
   - **Priority**: Medium (editor feature, less critical)

## 📋 Recommended Patterns

### For Errors (alert)

```tsx
const [errorModal, setErrorModal] = useState<{
  title: string;
  message: string;
} | null>(null);

// Usage
setErrorModal({
  title: "Operation Failed",
  message: "Failed to perform action. Please try again.",
});

// Modal JSX
{
  errorModal && (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-red-600 mb-4">
          {errorModal.title}
        </h3>
        <p className="text-gray-700 mb-6">{errorModal.message}</p>
        <div className="flex justify-end">
          <button
            onClick={() => setErrorModal(null)}
            className="px-4 py-2 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
```

### For Confirmations (confirm)

```tsx
const [confirmModal, setConfirmModal] = useState<{
  title: string;
  message: string;
  onConfirm: () => void;
} | null>(null);

// Usage
setConfirmModal({
  title: "Confirm Action",
  message: "Are you sure you want to proceed?",
  onConfirm: () => handleAction(),
});

// Modal JSX
{
  confirmModal && (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {confirmModal.title}
        </h3>
        <p className="text-gray-700 mb-6">{confirmModal.message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setConfirmModal(null)}
            className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              confirmModal.onConfirm();
              setConfirmModal(null);
            }}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
```

### For Prompts (prompt)

```tsx
const [promptModal, setPromptModal] = useState<{
  title: string;
  message: string;
  defaultValue?: string;
  onSubmit: (value: string) => void;
} | null>(null);
const [promptValue, setPromptValue] = useState("");

// Modal JSX
{
  promptModal && (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {promptModal.title}
        </h3>
        <p className="text-gray-700 mb-4">{promptModal.message}</p>
        <input
          type="text"
          value={promptValue}
          onChange={(e) => setPromptValue(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md mb-6"
          placeholder={promptModal.defaultValue}
        />
        <div className="flex justify-end gap-3">
          <button
            onClick={() => {
              setPromptModal(null);
              setPromptValue("");
            }}
            className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              promptModal.onSubmit(promptValue);
              setPromptModal(null);
              setPromptValue("");
            }}
            className="px-4 py-2 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
```

## Priority

1. **High**: Error alerts in critical flows (PurchaseSuccess, EditProgram)
2. **Medium**: Confirmation dialogs (EventDetail guest decline)
3. **Low**: Prompts in editor features (EventDetail link insertion)

## Notes

- All modals should support ESC key to close
- Consider adding a reusable Modal component to reduce code duplication
- Success messages could use toast notifications instead of modals for less intrusive UX
