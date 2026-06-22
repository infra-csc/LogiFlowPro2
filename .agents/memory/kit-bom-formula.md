---
name: Kit BOM formula expansion
description: Where kit BOM quantity-formula evaluation lives and the rule to keep copies in sync.
---

# Kit BOM formula expansion

A kit's `bom_lines.quantityFormula` is either `?` (variable, supplied per-request
via `request_items.kit_parameters[productId]`) or an arithmetic expression that
may reference named kit parameters. Final piece qty = `eval(formula with params
substituted) * multiplier`, then `Math.round`, clamped `>= 0`, with a finite
guard.

The same evaluation logic is implemented in **two** places:
- client: `calcFinalQty` in `client/src/components/add-item-dialog.tsx`
- server: `calcKitLineQty` inside the `GET /api/events/:id/materials-summary`
  handler in `server/routes.ts`

**Why:** the dialog computes line quantities for the cart; the materials-summary
endpoint re-expands kits server-side to aggregate pieces across all requisitions.
They must agree or the event summary will diverge from what users entered.

**How to apply:** any change to formula syntax, parameter substitution, rounding,
or clamping must be mirrored in both functions. There is no shared helper yet —
consider extracting one to `shared/` if this drifts.
