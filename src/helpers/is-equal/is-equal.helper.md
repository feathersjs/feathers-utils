---
title: isEqual
category: helpers
see:
  - helpers/isPlainObject
---

## Coming from lodash

Unlike `_.isEqual`, class instances, `Map`s and `Set`s are compared by
reference, and a mongo `ObjectId` by its hex string:

| a, b                                        | `_.isEqual` | `isEqual` |
| ------------------------------------------- | ----------- | --------- |
| `new ObjectId(x)`, `new ObjectId(x)`        | `true`      | `true`    |
| `new Map([[1, 2]])`, `new Map([[1, 2]])`    | `true`      | `false`   |
| two instances of a class with private state | `true`      | `false`   |

So `isEqual` can report two equal values as different, but never two different
values as equal — the safe direction for deciding whether a query, a cached
result or a patch has changed.
