---
title: deepFreeze
category: testing
tags:
  - testing
see:
  - testing/expectNoSideEffects
  - testing/runHook
---

## What Stays Writable

Freezing protects the properties of an object, not every kind of state:

- **Typed arrays** such as a `Buffer` are skipped, since they can't be frozen while they hold elements.
- **Maps and sets** are frozen as objects, but `set`, `add` and `delete` still work on them.
- **Private fields** (`#field`) of class instances stay writable.

To also catch writes that freezing can't stop, compare against a copy, as [`expectNoSideEffects`](/testing/expect-no-side-effects) does.
