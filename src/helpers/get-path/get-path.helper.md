---
title: getPath
category: helpers
see:
  - helpers/hasPath
  - helpers/setPath
  - helpers/pickPaths
---

## Coming from lodash

A drop-in for `_.get`: same path syntax, same `defaultValue` semantics — the
default is used for a missing path and for a value that is `undefined`, but not
for `null` or other falsy values. A key that literally contains a dot
(`{ 'a.b': 1 }`) wins over the nested reading, as in lodash.
