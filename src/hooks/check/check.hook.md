---
title: check
category: hooks
tags:
  - data
  - validation
  - multi
options: CheckOptions
hook:
  type: ['before', 'around']
  method: ['create', 'update', 'patch']
  multi: true
see:
  - hooks/unique
  - utils/getMergedData
  - hooks/checkRequired
---

<!-- options -->

## When It Tests

| Call                                    | Tested with                         | Fetch       |
| --------------------------------------- | ----------------------------------- | ----------- |
| `create`, `update`                      | `data`                              | none        |
| `patch` that changes no `from` field    | not tested                          | none        |
| `patch` whose `data` has all `from` fields | `data`                           | none        |
| any other `patch`                       | `data` merged over the stored items | one, [shared](/utils/get-merged-data) |

If the stored items were fetched, an item whose `from` fields keep their values is not tested - it passed when it got them. Values are compared by content - a bson `ObjectId` as well; a class that keeps its value in `#private` fields would look unchanged. Unlike a `CHECK` constraint added to a table, `check` doesn't go through the items stored before it was registered.
