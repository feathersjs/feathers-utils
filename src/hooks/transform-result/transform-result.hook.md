---
title: transformResult
category: hooks
hook:
  type: ["before", "after", "around"]
  method: ["find", "get", "create", "update", "patch", "remove"]
  multi: true
see: ["transformers", "utils/mutateResult"]
---

`transformResult` is a hook that allows you to transform the result data after it has been retrieved from the database. This can be useful for modifying the structure of the result, applying transformations to the fields, or adding additional information to the result.

## Transformers

'feathers-utils' provides a set of transformers that can be used with this hook. These transformers can be used to trim strings, convert dates, or omit fields from the result.

<TransformersList />
