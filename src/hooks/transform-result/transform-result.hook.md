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

## Async Transformations

This hook supports asynchronous transformations. You can return a promise from the hook to perform asynchronous operations before the result is processed. However, be cautious as this can lead to performance issues if the transformations are slow or if there are many records to process. When you need to call another service or perform a database query, it's usually better to create your own hook that fetches the necessary data before `transformResult` is called.

You can use `transformResult` like this:

```ts
import { transformResult } from "feathers-utils/hooks";
import { getResultIsArray } from "feathers-utils/utils";

const myHook = () => async (context) => {
  const { result } = getResultIsArray(context);

  await transformResult((item) => {
    // or whatever transformation you need
    item.userEmail = users.find((u) => u.id === item.userId)?.email;
    return item;
  })(context);
};
```

## Transformers

'feathers-utils' provides a set of transformers that can be used with this hook. These transformers can be used to trim strings, convert dates, or omit fields from the result.

<TransformersList />
