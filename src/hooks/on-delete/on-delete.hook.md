---
title: onDelete
category: hooks
hook:
  type: ["after", "around"]
  method: ["remove"]
  multi: true
---

The `onDelete` hook is used to manipulate related data when a record is deleted. This can include setting a foreign key to `null` or deleting related records.

## Example

```ts
// users.hooks.ts
import { onDelete } from "feathers-utils/hooks";

export default {
  // ...
  after: {
    // ...
    remove: [
      onDelete({
        service: "posts",
        keyThere: "userId",
        keyHere: "id",
        onDelete: "setNull",
      }),
    ],
  },
};
```
