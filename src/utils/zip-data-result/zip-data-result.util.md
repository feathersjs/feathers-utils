---
title: zipDataResult
category: utils
tags:
  - data
  - result
  - multi
options: ZipDataResultOptions
---

<!-- options -->

## Pairing by Id

By default, the items are paired by their position. On a multi create with ids in the data, `by: 'id'` pairs them by their id instead, whatever order the result has:

```ts
import { zipDataResult } from 'feathers-utils/utils'

const pairs = zipDataResult(context, { by: 'id' })
```

- A data item with an id gets the result with the same id, compared as strings, so bson `ObjectId`s match as well. Without such a result, `result` is `undefined`.
- A data item without an id gets the result at its position, unless another data item took that result by its id.
- The pairs are in the order of `context.data`, followed by the results no data item got, with `data: undefined`.
