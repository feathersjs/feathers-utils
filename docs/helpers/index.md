---
aside: false
---

# Helpers

Generic object and path helpers — the small building blocks the hooks and
utilities in this package are made of: reading, writing and picking dot paths,
deep equality, and a few type checks. They cover what a Feathers app usually
pulls in lodash for, with semantics tuned for Feathers: writes never leak into a
caller's `params`, and comparisons understand symbol operators and `ObjectId`s.

```ts
import { getPath, setPath, pickPaths, isEqual } from 'feathers-utils/helpers'
```

<HelpersTable />
