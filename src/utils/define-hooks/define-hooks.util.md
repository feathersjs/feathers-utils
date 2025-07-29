---
title: defineHooks
category: utils
---

When you define hooks in feathers like this:

```ts
export default {
  before: {
    // ...
  },
  // ...
};
```

you don't have autocompletion. Instead, you can use `defineHooks` to define type-safe hooks:

```ts
import { defineHooks } from "feathers-utils/utils";
export default defineHooks({
  before: {
    // ...
  },
  // ...
});
```
