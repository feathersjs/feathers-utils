---
title: transformData
category: hooks
hook:
  type: ["before", "around"]
  method: ["create", "update", "patch", "remove"]
  multi: true
  source:
transformers: true
see: ["transformers", "utils/mutateData"]
---

`transformData` is a very flexible hook that allows you to transform the data. It can be used to modify the data before it is sent to the database. This can be useful for applying transformations to the data fields, adding default values, or modifying the data structure.

## Async Transformations

This hook supports asynchronous transformations. You can return a promise from the hook to perform asynchronous operations before the data is processed. But be aware that this can lead to performance issues if the transformations are slow or if there are many records to process. When you need to call another service or perform a database query, it's usually better to create your own hook that fetches the necessary data before `transformData` is called.

You can use `transformData` like this:

```ts
import { transformData } from "feathers-utils/hooks";
import { getDataIsArray } from "feathers-utils/utils";

const myHook = () => async (context) => {
  const { data } = getDataIsArray(context);

  const users = await context.app.service("users").find({
    query: {
      id: { $in: data.map((d) => d.userId) },
    },
    paginate: false,
  });

  await transformData((item) => {
    // or whatever transformation you need
    item.userEmail = users.find((u) => u.id === item.userId)?.email;
    return item;
  })(context);
};
```

## Transformers

'feathers-utils' provides a set of transformers that can be used with this hook. These transformers can be used to trim strings, convert dates, or omit fields from the data.

<TransformersTable />
