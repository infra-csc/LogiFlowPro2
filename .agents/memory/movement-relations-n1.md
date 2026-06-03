---
name: Movement relations N+1
description: Movement event/trip relations must be batch-loaded, not per-movement
---

The movements list/detail storage methods attach many-to-many `events` and `trips`
relations (via the movement_events / movement_trips junction tables). These must be
batch-loaded for the whole result set using a single `inArray(movementId, ids)` query
per relation, then grouped in memory by movementId.

**Why:** the original code looped over each movement and ran 2 queries each (1 + 2N).
On the slow-app report, this was the dominant backend bottleneck — `getMovements()`
also fans out into `/api/events/:id/overview` and `/api/calendar/operational`, which
load all movements with relations.

**How to apply:** reuse the shared `attachMovementRelations()` helper in
`server/storage.ts` for any new method that returns movements with relations. Don't
reintroduce per-row relation queries. FK indexes on
movement_events.movement_id / movement_trips.movement_id back these joins.
