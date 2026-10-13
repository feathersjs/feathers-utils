---
title: throwIfIsMulti
category: hooks
tags:
  - validation
  - multi
options: ThrowIfIsMultiOptions
hook:
  type: ["before", "after", "around"]
  method: ["create", "patch", "remove"]
  multi: true
see:
  - hooks/checkMulti
  - predicates/isMulti
---

::: warning Deprecated
Use [`checkMulti`](/hooks/check-multi) with `multi: false` instead, and [`iff`](/hooks/iff) in place of `filter`. `checkMulti` throws a `MethodNotAllowed` error, not a `BadRequest`; pass `error` to keep the old one.

```ts
// before
throwIfIsMulti({ filter: isProvider('external') })
// after
iff(isProvider('external'), checkMulti({ multi: false }))
```
:::
