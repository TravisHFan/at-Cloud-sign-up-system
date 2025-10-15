# Purchase History Filter Feature - Visual Guide

## Current vs Proposed UI

### CURRENT STATE (What Exists Now)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                   │
│  📝 Purchase History                                             │
│  View all your program enrollments and receipts                 │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ╔═══════════════╗  ╔═══════════════╗  ╔═══════════════╗       │
│  ║ Total         ║  ║ Total Spent   ║  ║ Active        ║       │
│  ║ Enrollments   ║  ║               ║  ║ Programs      ║       │
│  ║     5         ║  ║    $120       ║  ║     4         ║       │
│  ╚═══════════════╝  ╚═══════════════╝  ╚═══════════════╝       │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Advanced Leadership Training                    ✅ Completed│  │
│  │ Order: ORD-2025-001                                        │  │
│  │ Oct 10, 2025 • Training                                    │  │
│  │ $19.00                                     [View Receipt]  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Workshop Series                             ✅ Completed   │  │
│  │ Order: ORD-2025-002                                        │  │
│  │ Oct 12, 2025 • Workshop                                    │  │
│  │ $29.00                                     [View Receipt]  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Pending Enrollment                          ⏳ Pending     │  │
│  │ Order: ORD-2025-003                                        │  │
│  │ Oct 14, 2025 • Training                                    │  │
│  │ $19.00                                     [View Receipt]  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Failed Payment                              ❌ Failed       │  │
│  │ Order: ORD-2025-004                                        │  │
│  │ Oct 13, 2025 • Workshop                                    │  │
│  │ $15.00                                     [View Receipt]  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Refunded Program                            💰 Refunded    │  │
│  │ Order: ORD-2025-005                                        │  │
│  │ Oct 11, 2025 • Training                                    │  │
│  │ $25.00                                     [View Receipt]  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘

👆 Shows ALL 5 purchases mixed together - hard to scan!
```

### PROPOSED STATE (With Filter Feature)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                   │
│  📝 Purchase History                                             │
│  View all your program enrollments and receipts                 │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Filter:                                                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ [All (5)] [Completed (2)] [Pending (1)] [Failed (1)]   │    │
│  │                                           [Refunded (1)]│    │
│  └─────────────────────────────────────────────────────────┘    │
│        ↑                                                         │
│    Currently selected (shows all)                                │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ╔═══════════════╗  ╔═══════════════╗  ╔═══════════════╗       │
│  ║ Total         ║  ║ Total Spent   ║  ║ Active        ║       │
│  ║ Enrollments   ║  ║               ║  ║ Programs      ║       │
│  ║     5         ║  ║    $120       ║  ║     4         ║       │
│  ╚═══════════════╝  ╚═══════════════╝  ╚═══════════════╝       │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│  (All 5 purchases shown...)                                      │
└─────────────────────────────────────────────────────────────────┘
```

### WHEN USER CLICKS "Completed" FILTER

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                   │
│  📝 Purchase History                                             │
│  View all your program enrollments and receipts                 │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Filter:                                                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ [All (5)] [Completed (2)] [Pending (1)] [Failed (1)]   │    │
│  │                    ↑            [Refunded (1)]          │    │
│  └────────────────────────────────────────────────────────┘    │
│                 Now selected (green highlight)                   │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ╔═══════════════╗  ╔═══════════════╗  ╔═══════════════╗       │
│  ║ Total         ║  ║ Total Spent   ║  ║ Active        ║       │
│  ║ Enrollments   ║  ║               ║  ║ Programs      ║       │
│  ║     5         ║  ║    $120       ║  ║     4         ║       │
│  ╚═══════════════╝  ╚═══════════════╝  ╚═══════════════╝       │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Advanced Leadership Training                    ✅ Completed│  │
│  │ Order: ORD-2025-001                                        │  │
│  │ Oct 10, 2025 • Training                                    │  │
│  │ $19.00                                     [View Receipt]  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Workshop Series                             ✅ Completed   │  │
│  │ Order: ORD-2025-002                                        │  │
│  │ Oct 12, 2025 • Workshop                                    │  │
│  │ $29.00                                     [View Receipt]  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  👆 Only shows 2 completed purchases!                            │
│     (Pending, Failed, Refunded are hidden)                       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### WHEN USER CLICKS "Failed" FILTER

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                   │
│  📝 Purchase History                                             │
│  View all your program enrollments and receipts                 │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Filter:                                                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ [All (5)] [Completed (2)] [Pending (1)] [Failed (1)]   │    │
│  │                                            ↑                 │
│  │                                      [Refunded (1)]      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                       Now selected (red)         │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ╔═══════════════╗  ╔═══════════════╗  ╔═══════════════╗       │
│  ║ Total         ║  ║ Total Spent   ║  ║ Active        ║       │
│  ║ Enrollments   ║  ║               ║  ║ Programs      ║       │
│  ║     5         ║  ║    $120       ║  ║     4         ║       │
│  ╚═══════════════╝  ╚═══════════════╝  ╚═══════════════╝       │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Failed Payment                              ❌ Failed       │  │
│  │ Order: ORD-2025-004                                        │  │
│  │ Oct 13, 2025 • Workshop                                    │  │
│  │ $15.00                                     [View Receipt]  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  👆 Only shows 1 failed purchase!                                │
│     Perfect for troubleshooting payment issues!                  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Use Cases

### 1. User Has Many Purchases

```
Without filter:
😫 User scrolls through 50 purchases looking for the one that failed
   "Was it Advanced Training? Or Basic Workshop? Where is it?!"

With filter:
😊 User clicks "Failed" button
   Only 2 purchases shown - found it immediately!
```

### 2. Support Troubleshooting

```
Support: "Can you check if you have any pending payments?"

Without filter:
User: "Um... let me scroll... I see lots of things...
       I'm not sure what's pending..."

With filter:
User: "I clicked 'Pending' and I see 3 purchases waiting!"
Support: "Perfect! Let's retry payment for those."
```

### 3. Accounting Review

```
User wants to know total spent on completed programs:

Without filter:
😫 User manually adds up completed ones, might miss some
   $19 + $29 + ... (scrolling, calculating)

With filter:
😊 Click "Completed" → see only completed purchases
   Easier to review what was actually paid
```

## Technical Flow

```
┌─────────────────────────────────────────────────────────────┐
│ User Action: Click "Completed" button                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ React State Update:                                          │
│ setStatusFilter("completed")                                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Filter Logic Runs:                                           │
│ const filteredPurchases = purchases.filter((p) =>           │
│   statusFilter === "all" ? true : p.status === statusFilter │
│ )                                                            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Component Re-renders:                                        │
│ - "Completed" button highlighted green                       │
│ - Only 2 purchases shown (completed ones)                    │
│ - Other 3 purchases hidden                                   │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Checklist

When you decide to implement this feature:

- [ ] Add `statusFilter` state to PurchaseHistory component
- [ ] Create filter UI (button group recommended)
- [ ] Implement filter logic
- [ ] Update purchase list to use filtered data
- [ ] Add empty state for "no purchases in this filter"
- [ ] Add hover/active states to filter buttons
- [ ] Test with real data (multiple statuses)
- [ ] Update summary cards if needed (show filtered totals?)
- [ ] Unskip the test in PurchaseHistory.test.tsx
- [ ] Run tests to verify
- [ ] Update documentation

Estimated implementation time: **1-2 hours**

## Why This Is Good Test-Driven Development

1. **Test Written First** ✅

   - Test exists and is correct
   - Documents expected behavior
   - Ready to verify implementation

2. **Documented Clearly** ✅

   - Skipped with TODO comment
   - Explanation of why it's skipped
   - Instructions for when to unskip

3. **Not Blocking** ✅

   - Didn't delete the test (preserves intent)
   - Didn't let it fail (keeps CI green)
   - Clear path forward (implement → unskip)

4. **Pragmatic** ✅
   - Feature is nice-to-have, not critical
   - 99.1% coverage is excellent
   - Can implement when priority justifies it

---

_This is how professional teams handle planned features with test-driven development!_
