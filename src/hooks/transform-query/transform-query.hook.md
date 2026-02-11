---
title: transformQuery
category: hooks
hook:
  type: ["before", "after", "around"]
  method: ["all"]
  multi: true
transformers: true
see: ["transformers"]
---

`transformQuery` is a hook that allows you to transform the query parameters before they are sent to the database. This can be useful for modifying the query structure, adding default values, or applying transformations to the query fields.

## Transformers

'feathers-utils' provides a set of transformers that can be used with this hook. These transformers can be used to trim strings, convert dates, or omit fields from the query.

<TransformersTable />
