---
name: Stock projection precedence model
description: How the day-by-day stock projection engine avoids double-counting demand across requests/loading-orders/movements.
---

# Stock projection precedence (Central de Projeção de Estoque)

The projection engine treats requests → loading orders → outbound movements as
progressive refinements of the SAME demand for a given `(eventId, productId)`, not
independent additive demands. Counting all three would triple-count.

## The rule
Precedence: outbound movement > loading order > approved request. Must be
**quantity-aware**, never boolean. A boolean "any higher source suppresses the
whole lower source" is wrong — a 2-unit physical movement must not wipe a 10-unit
loading-order commitment.

**Why:** an earlier boolean implementation made non-physical movements suppress
loading orders entirely and lost quantity when a small physical movement existed,
producing optimistic stock and missed shortages.

## How to apply
- Accumulate `movementOutboundQty[key]` from ALL outbound movements (physical +
  non-physical). Physical (`in_progress/paused/completed`) → `alreadyPhysical=true`
  (already in `currentStock`, only its return adds inbound; never re-subtract).
  Non-physical → future outbound flow.
- Loading orders AND standalone trips: net each item against a consumable clone of
  `movementOutboundQty`; only the uncovered remainder becomes a flow. Still record the
  FULL item qty into the committed-quantity tally per key (loading orders + standalone
  trips) so requests below are netted by it.
- Standalone trips are opt-in (default off) and exclude trips already tied to a loading
  order, so they never double-count what an order already represents.
- Requests: net against `max(movementOutboundQty[key], committedQty[key])`,
  consumed sequentially; only the uncovered remainder becomes a flow.
- Net effect: counted demand per key converges to
  `max(movementQty, loadingQty, requestQty)` — additive within a level, max-merge
  across levels.
- Multi-event movements: a movement linked to >1 in-scope event can't be cleanly
  split; emit a `warning` conflict and attribute precedence to `primaryEventId`.
  Never silently collapse.
- Items that cannot be dated (no trip/planned/event dates) → emit a conflict, never
  guess a date.
