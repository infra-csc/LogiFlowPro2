---
name: Multi-request junction pattern
description: How multi-requisição support is implemented in movements — junction table + legacy fallback.
---

## Rule
`movement_requests` junction table (movementId → requestId) stores the new many-to-many relationship. The legacy `requestId` nullable column on `movements` is kept for backward compatibility with existing data.

## How to apply
- **Read path**: `attachMovementRelations` queries junction table first; if empty, falls back to `movements.requestId` column. Returns `requests: RequestSummary[]` on every movement object (alongside legacy `request: RequestSummary | undefined`).
- **Write path (POST)**: `insertMovementWithEventsSchema` has `requestIds: z.array(z.string())`. `createMovementWithEvents` inserts junction rows, never sets the column.
- **Write path (PATCH)**: Extract `bodyRequestIds` before `insertMovementSchema.partial().parse()`; call `storage.updateMovementRequests(id, bodyRequestIds)` after `updateMovement`.
- **Frontend**: Form field `requestIds: string[]`; `usedRequestIds` set checks both `m.requests[]` and legacy `m.requestId`. `movement-details.tsx` resolves `canonicalRequestId = requests[0]?.id ?? requestId`.
- **Mutual exclusivity**: `loadingOrderId` and `requestIds.length > 0` cannot both be set.

**Why:** User requested the ability to select multiple requisições per movement (analogous to multi-trip selection). Junction table mirrors the existing `movementTrips` pattern.
