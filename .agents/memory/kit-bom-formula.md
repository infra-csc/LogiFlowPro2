---
name: Kit BOM formula expansion
description: Kit BOM quantity-formula evaluation is duplicated client+server and must stay in sync.
---

# Kit BOM formula expansion

A kit's BOM line `quantityFormula` is either `?` (variable — value supplied
per-request via the item's `kitParameters[productId]`) or an arithmetic
expression that may reference named kit parameters. Final piece qty =
`eval(formula with params substituted) * kitMultiplier`, then rounded, clamped
`>= 0`, with a finite-number guard.

The same evaluation logic is implemented in **two** places — once on the client
(the add-item dialog that builds the cart) and once on the server (the event
materials-summary endpoint that re-expands kits to aggregate across all
requisitions). There is no shared helper yet.

**Why:** the dialog and the summary endpoint must produce identical numbers, or
the event materials totals diverge from what users actually entered.

**How to apply:** any change to formula syntax, parameter substitution, rounding,
or clamping must be mirrored in both copies. Consider extracting a shared helper
into `shared/` if this drifts again.
