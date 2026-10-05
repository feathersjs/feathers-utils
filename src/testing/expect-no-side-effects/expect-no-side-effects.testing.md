---
title: expectNoSideEffects
category: testing
tags:
  - params
  - testing
see:
  - testing/deepFreeze
  - testing/runHook
  - utils/transformParams
---

## Return What You Assert On

Both runs have to return equal values, so let `fn` return the part of the outcome you want to check, such as `context.params`, `context.data` or `context.result`, and not the whole context. Each run builds its own context, with its own app and service, and those are not equal across two runs.

## What Counts as a Write

The input of the first run is compared with the original:

- Plain objects, arrays and class instances must have the same prototype and the same own enumerable keys, symbols included, with equal values under them. A key set to `undefined` counts as a change.
- Primitives are compared with `Object.is`, dates and regular expressions by value.
- Maps and sets are compared by their entries in order, so a `set` on a map is caught, although freezing does not stop it.
- Functions are compared by reference.

The frozen second run also catches writes that are undone before `fn` returns. Its error carries what `fn` threw, usually a `TypeError`, as `cause`.
