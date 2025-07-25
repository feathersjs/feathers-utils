---
title: transformData
category: hooks
hook:
  type: ["before", "around"]
  method: ["create", "update", "patch", "remove"]
  multi: true
  source:
see: ["transformers", "utils/mutateData"]
---

`transformData` is a very flexible hook that allows you to transform the data. It can be used to modify the data before it is sent to the database. This can be useful for applying transformations to the data fields, adding default values, or modifying the data structure.

## Transformers

'feathers-utils' provides a set of transformers that can be used with this hook. These transformers can be used to trim strings, convert dates, or omit fields from the data.

<TransformersList />
